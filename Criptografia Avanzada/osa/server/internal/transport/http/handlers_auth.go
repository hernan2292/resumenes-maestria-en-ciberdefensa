package http

import (
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/service"
)

type registerRequest struct {
	Email                  string `json:"email"`
	Password               string `json:"password"`
	Role                   string `json:"role"`
	MedicalLicense         string `json:"medical_license,omitempty"`
	KDFSaltBase64          string `json:"kdf_salt_base64"`
	PublicKeyBase64        string `json:"public_key_base64"`
	SigningPublicKeyBase64 string `json:"signing_public_key_base64"`
}

type registerResponse struct {
	UserID     string `json:"user_id"`
	PublicCode string `json:"public_code"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	salt, err1 := base64.StdEncoding.DecodeString(req.KDFSaltBase64)
	pubKey, err2 := base64.StdEncoding.DecodeString(req.PublicKeyBase64)
	signPubKey, err3 := base64.StdEncoding.DecodeString(req.SigningPublicKeyBase64)
	if err1 != nil || err2 != nil || err3 != nil {
		writeError(w, http.StatusBadRequest, "campos base64 inválidos")
		return
	}

	var license *string
	if req.MedicalLicense != "" {
		license = &req.MedicalLicense
	}

	u, err := s.Auth.Register(r.Context(), service.RegisterInput{
		Email:            req.Email,
		Password:         req.Password,
		Role:             domain.UserRole(req.Role),
		MedicalLicense:   license,
		KDFSalt:          salt,
		PublicKey:        pubKey,
		SigningPublicKey: signPubKey,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, registerResponse{UserID: u.ID.String(), PublicCode: u.PublicCode})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	TOTPCode string `json:"totp_code,omitempty"`
}

type loginResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresAt   string `json:"expires_at"`
	UserID      string `json:"user_id"`
	Role        string `json:"role"`
	PublicCode  string `json:"public_code"`
	KDFSaltB64  string `json:"kdf_salt_base64"`
	TOTPEnabled bool   `json:"totp_enabled"`
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	result, err := s.Auth.Login(r.Context(), service.LoginInput{
		Email:     req.Email,
		Password:  req.Password,
		TOTPCode:  req.TOTPCode,
		ClientIP:  clientIPFrom(r),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		status := http.StatusUnauthorized
		if errors.Is(err, service.ErrAccountLocked) {
			status = http.StatusTooManyRequests
		} else if errors.Is(err, service.ErrTOTPRequired) {
			status = http.StatusPreconditionRequired
		}
		writeError(w, status, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		AccessToken: result.AccessToken,
		ExpiresAt:   result.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
		UserID:      result.User.ID.String(),
		Role:        string(result.User.Role),
		PublicCode:  result.User.PublicCode,
		KDFSaltB64:  base64.StdEncoding.EncodeToString(result.User.KDFSalt),
		TOTPEnabled: result.User.TOTPEnabled,
	})
}

type totpSetupResponse struct {
	OTPAuthURI string `json:"otpauth_uri"`
}

// handleTOTPSetup genera un nuevo secreto TOTP (aún no habilitado hasta
// confirmar con /auth/totp/enable) para el usuario autenticado. Requerido
// por política para doctor/clinic_admin (adenda punto 4).
func (s *Server) handleTOTPSetup(w http.ResponseWriter, r *http.Request) {
	userID, _ := userIDFrom(r)
	u, err := s.Users.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "usuario no encontrado")
		return
	}
	_, encSecret, err := s.TOTP.GenerateSecret(u.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error generando TOTP")
		return
	}
	if err := s.Users.SetTOTP(r.Context(), userID, encSecret, false); err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando TOTP")
		return
	}
	uri, err := s.TOTP.URI(encSecret, u.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error generando URI TOTP")
		return
	}
	writeJSON(w, http.StatusOK, totpSetupResponse{OTPAuthURI: uri})
}

type totpEnableRequest struct {
	Code string `json:"code"`
}

func (s *Server) handleTOTPEnable(w http.ResponseWriter, r *http.Request) {
	var req totpEnableRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	userID, _ := userIDFrom(r)
	u, err := s.Users.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "usuario no encontrado")
		return
	}
	ok, err := s.TOTP.ValidateCode(u.TOTPSecretEnc, req.Code)
	if err != nil || !ok {
		writeError(w, http.StatusBadRequest, "código TOTP inválido")
		return
	}
	if err := s.Users.SetTOTP(r.Context(), userID, u.TOTPSecretEnc, true); err != nil {
		writeError(w, http.StatusInternalServerError, "error habilitando TOTP")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"enabled": true})
}
