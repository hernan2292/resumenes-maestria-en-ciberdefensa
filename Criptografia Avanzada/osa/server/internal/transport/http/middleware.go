package http

import (
	"context"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
	"github.com/osa-project/server/internal/service"
)

type ctxKey int

const (
	ctxKeyUserID ctxKey = iota
	ctxKeyUserRole
	ctxKeyClientIP
)

// SecurityHeaders agrega las cabeceras de la Sección 5 de la adenda
// (punto 5). CSP es restrictiva porque esta API sólo sirve JSON, nunca HTML
// de terceros.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// CORS restringe orígenes a la lista configurada (portal paciente/médico).
// No usamos "*" nunca: esta API maneja Bearer tokens que un origen
// arbitrario no debería poder invocar desde el navegador del usuario.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && allowed[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP extrae la IP real del cliente considerando un único reverse
// proxy de confianza (ver docker-compose.yml / README sobre X-Forwarded-For
// y por qué NO se confía en esta cabecera si no hay proxy conocido
// delante).
func withClientIP(trustProxy bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if host, _, err := net.SplitHostPort(ip); err == nil {
				ip = host
			}
			if trustProxy {
				if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
					parts := strings.Split(fwd, ",")
					ip = strings.TrimSpace(parts[0])
				}
			}
			ctx := context.WithValue(r.Context(), ctxKeyClientIP, ip)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func clientIPFrom(r *http.Request) string {
	if v, ok := r.Context().Value(ctxKeyClientIP).(string); ok {
		return v
	}
	return "0.0.0.0"
}

// Authenticate valida el Bearer JWT y coloca userID/rol en el contexto. No
// hay cookies de sesión en ningún punto del sistema (adenda punto 6).
func Authenticate(issuer *crypto.JWTIssuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				writeError(w, http.StatusUnauthorized, "falta el header Authorization: Bearer <token>")
				return
			}
			token := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := issuer.Verify(token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "token inválido o expirado")
				return
			}
			ctx := context.WithValue(r.Context(), ctxKeyUserID, claims.UserID)
			ctx = context.WithValue(ctx, ctxKeyUserRole, domain.UserRole(claims.Role))
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func userIDFrom(r *http.Request) (uuid.UUID, bool) {
	v, ok := r.Context().Value(ctxKeyUserID).(uuid.UUID)
	return v, ok
}

func userRoleFrom(r *http.Request) (domain.UserRole, bool) {
	v, ok := r.Context().Value(ctxKeyUserRole).(domain.UserRole)
	return v, ok
}

// RequireRole restringe un handler a uno o más roles.
func RequireRole(roles ...domain.UserRole) func(http.Handler) http.Handler {
	allowed := make(map[domain.UserRole]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := userRoleFrom(r)
			if !ok || !allowed[role] {
				writeError(w, http.StatusForbidden, "rol no autorizado para este recurso")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireDoctorMFA cierra en runtime el hueco de la política descrita en la
// adenda punto 4 ("TOTP obligatorio para médico/clínica"): esa regla vivía
// sólo como la función service.RequireDoctorMFA, declarada pero nunca
// invocada desde ningún handler, así que en la práctica un médico sin 2FA
// habilitado podía igual consumir una delegación. El JWT no lleva
// TOTPEnabled (se decide en cada login, no es estático), así que este
// middleware consulta el estado actual en base de datos. Se aplica sólo al
// endpoint que un médico usa para descubrir y obtener las claves de una
// delegación (GET /api/v1/delegations/active): sin pasar por ahí, el
// cliente del médico nunca llega a tener K_idx/K_enc de ningún paciente, así
// que gatear ese único punto de entrada alcanza para bloquear en la
// práctica toda la superficie de lectura/búsqueda delegada.
func RequireDoctorMFA(users *postgres.UserRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID, ok := userIDFrom(r)
			if !ok {
				writeError(w, http.StatusUnauthorized, "no autenticado")
				return
			}
			u, err := users.GetByID(r.Context(), userID)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "usuario no encontrado")
				return
			}
			if err := service.RequireDoctorMFA(u); err != nil {
				writeError(w, http.StatusPreconditionRequired, err.Error())
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequestLogger loguea método, ruta, status y latencia — nunca body,
// headers de auth, ni query strings (podrían contener tokens).
func RequestLogger(logger func(format string, args ...any)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)
			logger("%s %s -> %d (%s)", r.Method, r.URL.Path, sw.status, time.Since(start))
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// LoginRateLimit protege /auth/login contra fuerza bruta por IP+email
// (adenda punto 3). Se aplica antes de tocar la base de datos.
func LoginRateLimit(limiter *crypto.LoginRateLimiter, keyFn func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			if !limiter.Allow(key) {
				writeError(w, http.StatusTooManyRequests, "demasiados intentos, intente de nuevo más tarde")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
