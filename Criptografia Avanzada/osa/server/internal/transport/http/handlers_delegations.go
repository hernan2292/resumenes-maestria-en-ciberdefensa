package http

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/service"
)

type createDelegationRequest struct {
	DoctorID                   string `json:"doctor_id"`
	Scope                      string `json:"scope"`
	ScopeLabelHex              string `json:"scope_label_hex,omitempty"`
	EncryptedKeysForDoctorB64  string `json:"encrypted_keys_for_doctor_base64"`
	ValidFrom                  string `json:"valid_from"` // RFC3339
	ValidUntil                 string `json:"valid_until"`
	PatientSignatureHex        string `json:"patient_signature_hex"`
}

type delegationResponse struct {
	ID          string `json:"id"`
	DoctorID    string `json:"doctor_id"`
	Scope       string `json:"scope"`
	ValidFrom   string `json:"valid_from"`
	ValidUntil  string `json:"valid_until"`
	IsRevoked   bool   `json:"is_revoked"`
}

// handleCreateDelegation implementa el paso 2 del protocolo de la Sección
// 3.1: el paciente ya armó y firmó el ticket en su navegador; el servidor
// sólo valida (firma Ed25519, ventana de tiempo, tope de 120 min — adenda
// punto 12) y persiste.
func (s *Server) handleCreateDelegation(w http.ResponseWriter, r *http.Request) {
	var req createDelegationRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	doctorID, err := uuid.Parse(req.DoctorID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "doctor_id inválido")
		return
	}
	validFrom, err1 := time.Parse(time.RFC3339, req.ValidFrom)
	validUntil, err2 := time.Parse(time.RFC3339, req.ValidUntil)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, "fechas inválidas (usar RFC3339)")
		return
	}
	encryptedKeys, err := base64.StdEncoding.DecodeString(req.EncryptedKeysForDoctorB64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "encrypted_keys_for_doctor_base64 inválido")
		return
	}
	signature, err := hexDecodeSignature(req.PatientSignatureHex)
	if err != nil {
		writeError(w, http.StatusBadRequest, "patient_signature_hex inválido")
		return
	}
	var scopeLabel []byte
	if req.ScopeLabelHex != "" {
		scopeLabel, err = decodeHexLabel(req.ScopeLabelHex)
		if err != nil {
			writeError(w, http.StatusBadRequest, "scope_label_hex inválido")
			return
		}
	}
	if req.Scope == "" {
		req.Scope = "all"
	}

	patientID, _ := userIDFrom(r)

	d, err := s.Delegation.Create(r.Context(), service.CreateDelegationInput{
		PatientID:              patientID,
		DoctorID:               doctorID,
		Scope:                  req.Scope,
		ScopeLabel:             scopeLabel,
		EncryptedKeysForDoctor: encryptedKeys,
		ValidFrom:              validFrom,
		ValidUntil:             validUntil,
		PatientSignature:       signature,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toDelegationResponse(d))
}

func toDelegationResponse(d *domain.AccessDelegation) delegationResponse {
	return delegationResponse{
		ID:         d.ID.String(),
		DoctorID:   d.DoctorID.String(),
		Scope:      d.Scope,
		ValidFrom:  d.ValidFrom.Format(time.RFC3339),
		ValidUntil: d.ValidUntil.Format(time.RFC3339),
		IsRevoked:  d.IsRevoked,
	}
}

func (s *Server) handleListMyDelegations(w http.ResponseWriter, r *http.Request) {
	patientID, _ := userIDFrom(r)
	delegations, err := s.Delegation.ListActiveForPatient(r.Context(), patientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error listando delegaciones")
		return
	}
	out := make([]delegationResponse, 0, len(delegations))
	for i := range delegations {
		out = append(out, toDelegationResponse(&delegations[i]))
	}
	writeJSON(w, http.StatusOK, out)
}

// handleRevokeDelegation es el "Botón de Revocación de Pánico" (Sección
// 6.1.A): invalidación en 1-click.
func (s *Server) handleRevokeDelegation(w http.ResponseWriter, r *http.Request) {
	delegationID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}
	patientID, _ := userIDFrom(r)
	if err := s.Delegation.Revoke(r.Context(), patientID, delegationID); err != nil {
		status := http.StatusForbidden
		if errors.Is(err, service.ErrUnauthorizedAccess) {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"revoked": true})
}

// handleGetActiveDelegationForDoctor: el cliente del médico lo llama para
// descubrir si tiene un ticket vigente para un paciente dado (Sección
// 3.1, paso "GET /api/v1/delegations/active").
func (s *Server) handleGetActiveDelegationForDoctor(w http.ResponseWriter, r *http.Request) {
	patientID, err := uuid.Parse(r.URL.Query().Get("patient_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "patient_id inválido")
		return
	}
	doctorID, _ := userIDFrom(r)
	d, err := s.Delegation.GetActiveForDoctor(r.Context(), doctorID, patientID)
	if err != nil {
		writeError(w, http.StatusNotFound, "no hay delegación activa")
		return
	}
	writeJSON(w, http.StatusOK, struct {
		delegationResponse
		EncryptedKeysForDoctorBase64 string `json:"encrypted_keys_for_doctor_base64"`
	}{
		delegationResponse:          toDelegationResponse(d),
		EncryptedKeysForDoctorBase64: base64.StdEncoding.EncodeToString(d.EncryptedKeysForDoctor),
	})
}

func hexDecodeSignature(s string) ([]byte, error) {
	if len(s) == 0 {
		return nil, errors.New("firma vacía")
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil, err
	}
	if len(b) != 64 { // Ed25519 signature size
		return nil, errors.New("longitud de firma inválida")
	}
	return b, nil
}
