package http

import (
	"encoding/base64"
	"net/http"

	"github.com/osa-project/server/internal/repository/postgres"
)

type meResponse struct {
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	PublicCode  string `json:"public_code"`
	TOTPEnabled bool   `json:"totp_enabled"`
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	userID, _ := userIDFrom(r)
	u, err := s.Users.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "usuario no encontrado")
		return
	}
	writeJSON(w, http.StatusOK, meResponse{
		UserID:      u.ID.String(),
		Email:       u.Email,
		Role:        string(u.Role),
		PublicCode:  u.PublicCode,
		TOTPEnabled: u.TOTPEnabled,
	})
}

type publicUserResponse struct {
	UserID                 string `json:"user_id"`
	Role                   string `json:"role"`
	PublicCode             string `json:"public_code"`
	PublicKeyBase64        string `json:"public_key_base64"`
	SigningPublicKeyBase64 string `json:"signing_public_key_base64"`
}

// handleGetByPublicCode es el único lookup cruzado permitido (adenda punto
// 15): nunca por email, y sólo se exponen claves públicas + rol, nunca
// datos de contacto.
func (s *Server) handleGetByPublicCode(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	u, err := s.Users.GetByPublicCode(r.Context(), code)
	if err != nil {
		if err == postgres.ErrNotFound {
			writeError(w, http.StatusNotFound, "código no encontrado")
			return
		}
		writeError(w, http.StatusInternalServerError, "error interno")
		return
	}
	writeJSON(w, http.StatusOK, publicUserResponse{
		UserID:                 u.ID.String(),
		Role:                   string(u.Role),
		PublicCode:             u.PublicCode,
		PublicKeyBase64:        base64.StdEncoding.EncodeToString(u.PublicKey),
		SigningPublicKeyBase64: base64.StdEncoding.EncodeToString(u.SigningPublicKey),
	})
}
