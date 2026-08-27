package http

import (
	"encoding/base64"
	"net/http"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/service"
)

type searchBatchRequest struct {
	PatientID    string   `json:"patient_id"`
	DelegationID string   `json:"delegation_id,omitempty"`
	LabelsHex    []string `json:"labels_hex"`
}

type labelResultResponse struct {
	LabelHex             string `json:"label_hex"`
	HasMatch             bool   `json:"has_match"`
	EncryptedPostingListB64 string `json:"encrypted_posting_list_base64,omitempty"`
}

const maxBatchLabels = 32 // suficiente para consultas reales + señuelo (adenda punto 8)

// handleSearchBatch: ver adenda punto 14. Devuelve la posting list TODAVÍA
// CIFRADA; el cliente la descifra y luego pide documentos puntuales por ID
// a través de GET /api/v1/documents/{id}.
func (s *Server) handleSearchBatch(w http.ResponseWriter, r *http.Request) {
	var req searchBatchRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if len(req.LabelsHex) == 0 || len(req.LabelsHex) > maxBatchLabels {
		writeError(w, http.StatusBadRequest, "cantidad de etiquetas fuera de rango")
		return
	}
	patientID, err := uuid.Parse(req.PatientID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "patient_id inválido")
		return
	}
	var delegationID *uuid.UUID
	if req.DelegationID != "" {
		id, err := uuid.Parse(req.DelegationID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "delegation_id inválido")
			return
		}
		delegationID = &id
	}

	requesterID, _ := userIDFrom(r)
	requesterRole, _ := userRoleFrom(r)

	results, err := s.Search.SearchBatch(r.Context(), service.SearchBatchInput{
		RequesterID:   requesterID,
		RequesterRole: requesterRole,
		PatientID:     patientID,
		DelegationID:  delegationID,
		LabelsHex:     req.LabelsHex,
		ClientIP:      clientIPFrom(r),
		UserAgent:     r.UserAgent(),
	})
	if err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	out := make([]labelResultResponse, 0, len(results))
	for _, res := range results {
		item := labelResultResponse{LabelHex: res.LabelHex, HasMatch: res.HasMatch}
		if res.HasMatch {
			item.EncryptedPostingListB64 = base64.StdEncoding.EncodeToString(res.Ciphertext)
		}
		out = append(out, item)
	}
	writeJSON(w, http.StatusOK, out)
}

type upsertIndexRequest struct {
	PatientID               string `json:"patient_id"`
	DelegationID            string `json:"delegation_id,omitempty"`
	LookupLabelHex          string `json:"lookup_label_hex"`
	EncryptedPostingListB64 string `json:"encrypted_posting_list_base64"`
}

// handleUpsertIndex: el propio paciente puede indexar siempre; un médico o
// clínica sólo mientras sostiene una delegación activa y vigente para ese
// paciente (adenda punto 16) — es lo que le da legítimamente K_idx.
func (s *Server) handleUpsertIndex(w http.ResponseWriter, r *http.Request) {
	var req upsertIndexRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	label, err := decodeHexLabel(req.LookupLabelHex)
	if err != nil {
		writeError(w, http.StatusBadRequest, "lookup_label_hex inválido")
		return
	}
	posting, err := base64.StdEncoding.DecodeString(req.EncryptedPostingListB64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "encrypted_posting_list_base64 inválido")
		return
	}

	requesterID, _ := userIDFrom(r)
	requesterRole, _ := userRoleFrom(r)

	patientID := requesterID
	var delegationID *uuid.UUID
	if req.PatientID != "" {
		parsed, err := uuid.Parse(req.PatientID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "patient_id inválido")
			return
		}
		patientID = parsed
	}
	if req.DelegationID != "" {
		id, err := uuid.Parse(req.DelegationID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "delegation_id inválido")
			return
		}
		delegationID = &id
	}

	if err := s.Search.UpsertIndex(r.Context(), service.UpsertIndexInput{
		RequesterID:          requesterID,
		RequesterRole:        requesterRole,
		PatientID:            patientID,
		DelegationID:         delegationID,
		LookupLabel:          label,
		EncryptedPostingList: posting,
	}); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
