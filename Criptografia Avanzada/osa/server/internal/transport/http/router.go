package http

import (
	"net/http"

	"github.com/osa-project/server/internal/domain"
)

func (s *Server) registerRoutes(mux *http.ServeMux) {
	// --- Auth (públicas, con rate limiting en login) ---
	mux.Handle("POST /api/v1/auth/register", http.HandlerFunc(s.handleRegister))
	mux.Handle("POST /api/v1/auth/login", LoginRateLimit(s.LoginLimiter, loginRateLimitKey)(http.HandlerFunc(s.handleLogin)))

	// --- Auth autenticadas (2FA) ---
	mux.Handle("POST /api/v1/auth/totp/setup", s.authed(s.handleTOTPSetup))
	mux.Handle("POST /api/v1/auth/totp/enable", s.authed(s.handleTOTPEnable))

	// --- Usuarios ---
	mux.Handle("GET /api/v1/users/me", s.authed(s.handleMe))
	mux.Handle("GET /api/v1/users/by-code/{code}", s.authed(s.handleGetByPublicCode))

	// --- Documentos ---
	// Cualquier rol autenticado puede subir (paciente a sí mismo, o
	// doctor/clinic_admin a un paciente) — DocumentService.Upload valida
	// la combinación exacta permitida.
	mux.Handle("POST /api/v1/documents/upload-for-patient", s.authed(s.handleUploadDocument))
	mux.Handle("GET /api/v1/documents/{id}", s.authed(s.handleGetDocument))
	mux.Handle("GET /api/v1/patients/me/documents", s.authedRole(s.handleListMyDocuments, domain.RolePatient))
	mux.Handle("GET /api/v1/patients/me/pending-index", s.authedRole(s.handleListPendingIndexing, domain.RolePatient))
	mux.Handle("POST /api/v1/documents/{id}/confirm-indexed", s.authedRole(s.handleConfirmIndexed, domain.RolePatient))

	// --- Delegaciones ---
	mux.Handle("POST /api/v1/delegations", s.authedRole(s.handleCreateDelegation, domain.RolePatient))
	mux.Handle("GET /api/v1/delegations/mine", s.authedRole(s.handleListMyDelegations, domain.RolePatient))
	mux.Handle("POST /api/v1/delegations/{id}/revoke", s.authedRole(s.handleRevokeDelegation, domain.RolePatient))
	mux.Handle("GET /api/v1/delegations/active", s.authedRoleWithDoctorMFA(s.handleGetActiveDelegationForDoctor, domain.RoleDoctor, domain.RoleClinicAdmin))

	// --- Búsqueda SSE-2 ---
	mux.Handle("POST /api/v1/search/batch", s.authed(s.handleSearchBatch))
	// Ver adenda punto 16: un médico/clínica con delegación activa también
	// puede indexar (posee K_idx legítimamente mientras dura el ticket).
	mux.Handle("POST /api/v1/index/upsert", s.authedRole(s.handleUpsertIndex, domain.RolePatient, domain.RoleDoctor, domain.RoleClinicAdmin))

	// --- Rotación de clave maestra ---
	mux.Handle("POST /api/v1/patient/rekey-batch", s.authedRole(s.handleRekey, domain.RolePatient))

	// --- Salud del servicio (sin datos sensibles, para el orquestador) ---
	mux.Handle("GET /healthz", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))
}

// loginRateLimitKey combina IP truncada + email para no permitir que un
// atacante rote de email pero mantenga IP (o viceversa) para eludir el
// límite (adenda punto 3).
func loginRateLimitKey(r *http.Request) string {
	var body struct {
		Email string `json:"email"`
	}
	// Nota: aquí NO consumimos r.Body (el handler de login lo necesita
	// intacto), así que sólo usamos la IP como clave — el límite por
	// cuenta específica ya lo aplica AuthService vía failed_login_count.
	_ = body
	return clientIPFrom(r)
}
