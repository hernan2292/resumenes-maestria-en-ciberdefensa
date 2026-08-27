package http

import (
	"encoding/base64"
	"net/http"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/service"
)

type rekeyIndexEntry struct {
	LookupLabelHex          string `json:"lookup_label_hex"`
	EncryptedPostingListB64 string `json:"encrypted_posting_list_base64"`
}

// rekeyDocumentEnvelope: ver adenda punto 19 — un sobre re-envuelto por
// documento, obligatorio para que la rotación de identidad no deje ningún
// documento existente indescifrable.
type rekeyDocumentEnvelope struct {
	DocumentID                 string `json:"document_id"`
	EncryptedKeyEnvelopeBase64 string `json:"encrypted_key_envelope_base64"`
}

type rekeyRequest struct {
	NewPassword               string                  `json:"new_password"`
	NewKDFSaltBase64          string                  `json:"new_kdf_salt_base64"`
	NewPublicKeyBase64        string                  `json:"new_public_key_base64"`
	NewSigningPublicKeyBase64 string                  `json:"new_signing_public_key_base64"`
	NewIndexEntries           []rekeyIndexEntry       `json:"new_index_entries"`
	NewDocumentKeyEnvelopes   []rekeyDocumentEnvelope `json:"new_document_key_envelopes"`
}

// handleRekey implementa el Flujo B (Sección 4.2): rotación soberana de
// clave maestra. Es intencionalmente todo-o-nada (ver RekeyService.Rekey):
// si algo falla a mitad de camino, no queda al paciente con índice o
// identidad a medio migrar.
func (s *Server) handleRekey(w http.ResponseWriter, r *http.Request) {
	var req rekeyRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	salt, e1 := base64.StdEncoding.DecodeString(req.NewKDFSaltBase64)
	pub, e2 := base64.StdEncoding.DecodeString(req.NewPublicKeyBase64)
	signPub, e3 := base64.StdEncoding.DecodeString(req.NewSigningPublicKeyBase64)
	if e1 != nil || e2 != nil || e3 != nil {
		writeError(w, http.StatusBadRequest, "campos base64 inválidos")
		return
	}

	entries := make([]domain.SSEIndexEntry, 0, len(req.NewIndexEntries))
	for _, e := range req.NewIndexEntries {
		label, err := decodeHexLabel(e.LookupLabelHex)
		if err != nil {
			writeError(w, http.StatusBadRequest, "lookup_label_hex inválido en new_index_entries")
			return
		}
		posting, err := base64.StdEncoding.DecodeString(e.EncryptedPostingListB64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "encrypted_posting_list_base64 inválido en new_index_entries")
			return
		}
		entries = append(entries, domain.SSEIndexEntry{LookupLabel: label, EncryptedPostingList: posting})
	}

	docEnvelopes := make([]domain.DocumentKeyEnvelopeUpdate, 0, len(req.NewDocumentKeyEnvelopes))
	for _, e := range req.NewDocumentKeyEnvelopes {
		docID, err := uuid.Parse(e.DocumentID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "document_id inválido en new_document_key_envelopes")
			return
		}
		envelope, err := base64.StdEncoding.DecodeString(e.EncryptedKeyEnvelopeBase64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "encrypted_key_envelope_base64 inválido en new_document_key_envelopes")
			return
		}
		docEnvelopes = append(docEnvelopes, domain.DocumentKeyEnvelopeUpdate{DocumentID: docID, EncryptedKeyEnvelope: envelope})
	}

	patientID, _ := userIDFrom(r)
	if err := s.Rekey.Rekey(r.Context(), service.RekeyInput{
		PatientID:               patientID,
		NewPassword:             req.NewPassword,
		NewKDFSalt:              salt,
		NewPublicKey:            pub,
		NewSigningPublicKey:     signPub,
		NewIndexEntries:         entries,
		NewDocumentKeyEnvelopes: docEnvelopes,
	}); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"rekeyed": true})
}
