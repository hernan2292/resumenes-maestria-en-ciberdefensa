// Package http contiene el transporte REST: parseo/validación de
// requests, invocación de servicios de negocio, serialización de
// responses. Ningún handler contiene lógica criptográfica ni de
// autorización de dominio — eso vive en internal/service (así se puede
// testear sin levantar un servidor HTTP).
package http

import (
	"log"
	"net/http"

	"github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
	"github.com/osa-project/server/internal/service"
)

type Server struct {
	Auth       *service.AuthService
	Delegation *service.DelegationService
	Document   *service.DocumentService
	Search     *service.SSESearchService
	Rekey      *service.RekeyService
	Users      *postgres.UserRepository
	Audit      *postgres.AuditRepository
	TOTP       *crypto.TOTPManager
	JWT        *crypto.JWTIssuer

	LoginLimiter   *crypto.LoginRateLimiter
	AllowedOrigins []string
	IPTruncate     bool
	// TrustProxy debe ser true SÓLO si hay un reverse proxy de confianza
	// (nginx/Caddy propio) delante que sanea X-Forwarded-For. En caso
	// contrario cualquier cliente podría falsificar su IP en el log de
	// auditoría.
	TrustProxy bool
}

// authed envuelve un handler exigiendo un Bearer JWT válido.
func (s *Server) authed(h http.HandlerFunc) http.Handler {
	return Authenticate(s.JWT)(h)
}

// authedRole además exige que el rol autenticado esté en la lista dada.
func (s *Server) authedRole(h http.HandlerFunc, roles ...domain.UserRole) http.Handler {
	return Authenticate(s.JWT)(RequireRole(roles...)(h))
}

// authedRoleWithDoctorMFA es como authedRole pero además exige, para
// médico/clínica, tener TOTP habilitado (adenda punto 4/18).
func (s *Server) authedRoleWithDoctorMFA(h http.HandlerFunc, roles ...domain.UserRole) http.Handler {
	return Authenticate(s.JWT)(RequireRole(roles...)(RequireDoctorMFA(s.Users)(h)))
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	s.registerRoutes(mux)

	var h http.Handler = mux
	h = RequestLogger(func(format string, args ...any) { log.Printf(format, args...) })(h)
	h = withClientIP(s.TrustProxy)(h)
	h = CORS(s.AllowedOrigins)(h)
	h = SecurityHeaders(h)
	return h
}
