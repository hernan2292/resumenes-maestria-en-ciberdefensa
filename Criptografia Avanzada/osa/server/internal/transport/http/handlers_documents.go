package http

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/service"
)

type uploadDocumentRequest struct {
	PatientID                          string   `json:"patient_id"`
	TitleEncryptedBase64                string   `json:"title_encrypted_base64"`
	DocTypeEncryptedBase64              string   `json:"doc_type_encrypted_base64"`
	EncryptedBlobBase64                 string   `json:"encrypted_blob_base64"`
	EncryptedKeyEnvelopeBase64          string   `json:"encrypted_key_envelope_base64"`
	EncryptedKeyEnvelopeSymmetricBase64 string   `json:"encrypted_key_envelope_symmetric_base64,omitempty"`
	ScopeLabelsHex                      []string `json:"scope_labels_hex,omitempty"`
	NeedsIndexing                       bool     `json:"needs_indexing"`
}

type uploadDocumentResponse struct {
	DocumentID string `json:"document_id"`
}

func (s *Server) handleUploadDocument(w http.ResponseWriter, r *http.Request) {
	var req uploadDocumentRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	patientID, err := uuid.Parse(req.PatientID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "patient_id inválido")
		return
	}
	title, e1 := base64.StdEncoding.DecodeString(req.TitleEncryptedBase64)
	docType, e2 := base64.StdEncoding.DecodeString(req.DocTypeEncryptedBase64)
	blob, e3 := base64.StdEncoding.DecodeString(req.EncryptedBlobBase64)
	envelope, e4 := base64.StdEncoding.DecodeString(req.EncryptedKeyEnvelopeBase64)
	if e1 != nil || e2 != nil || e3 != nil || e4 != nil {
		writeError(w, http.StatusBadRequest, "campos base64 inválidos")
		return
	}
	var symmetricEnvelope []byte
	if req.EncryptedKeyEnvelopeSymmetricBase64 != "" {
		symmetricEnvelope, err = base64.StdEncoding.DecodeString(req.EncryptedKeyEnvelopeSymmetricBase64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "encrypted_key_envelope_symmetric_base64 inválido")
			return
		}
	}
	scopeLabels := make([][]byte, 0, len(req.ScopeLabelsHex))
	for _, hexLabel := range req.ScopeLabelsHex {
		b, err := decodeHexLabel(hexLabel)
		if err != nil {
			writeError(w, http.StatusBadRequest, "scope_labels_hex inválido")
			return
		}
		scopeLabels = append(scopeLabels, b)
	}

	uploaderID, _ := userIDFrom(r)
	uploaderRole, _ := userRoleFrom(r)

	doc, err := s.Document.Upload(r.Context(), service.UploadInput{
		UploaderID:                    uploaderID,
		UploaderRole:                  uploaderRole,
		PatientID:                     patientID,
		TitleEncrypted:                title,
		DocTypeEncrypted:              docType,
		EncryptedBlob:                 blob,
		EncryptedKeyEnvelope:          envelope,
		EncryptedKeyEnvelopeSymmetric: symmetricEnvelope,
		ScopeLabels:                   scopeLabels,
		NeedsIndexing:                 req.NeedsIndexing,
	})
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrNotAuthorizedToUpload) {
			status = http.StatusForbidden
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, uploadDocumentResponse{DocumentID: doc.ID.String()})
}

type documentResponse struct {
	DocumentID                          string `json:"document_id"`
	UploadedByID                        string `json:"uploaded_by_id"`
	TitleEncryptedBase64                string `json:"title_encrypted_base64"`
	DocTypeEncryptedBase64              string `json:"doc_type_encrypted_base64"`
	EncryptedBlobBase64                 string `json:"encrypted_blob_base64"`
	EncryptedKeyEnvelopeBase64          string `json:"encrypted_key_envelope_base64"`
	EncryptedKeyEnvelopeSymmetricBase64 string `json:"encrypted_key_envelope_symmetric_base64,omitempty"`
	CreatedAt                           string `json:"created_at"`
}

func toDocumentResponse(d *domain.EncryptedDocumentResult) documentResponse {
	resp := documentResponse{
		DocumentID:                 d.ID.String(),
		UploadedByID:               d.UploadedByID.String(),
		TitleEncryptedBase64:       base64.StdEncoding.EncodeToString(d.TitleEncrypted),
		DocTypeEncryptedBase64:     base64.StdEncoding.EncodeToString(d.DocTypeEncrypted),
		EncryptedBlobBase64:        base64.StdEncoding.EncodeToString(d.EncryptedBlob),
		EncryptedKeyEnvelopeBase64: base64.StdEncoding.EncodeToString(d.EncryptedKeyEnvelope),
		CreatedAt:                  d.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if len(d.EncryptedKeyEnvelopeSymmetric) > 0 {
		resp.EncryptedKeyEnvelopeSymmetricBase64 = base64.StdEncoding.EncodeToString(d.EncryptedKeyEnvelopeSymmetric)
	}
	return resp
}

// handleGetDocument implementa el paso 3 del flujo corregido (adenda punto
// 14): entrega el blob de UN documento puntual, aplicando ahí el
// enforcement de scope de la delegación.
func (s *Server) handleGetDocument(w http.ResponseWriter, r *http.Request) {
	docID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id de documento inválido")
		return
	}
	patientID, err := uuid.Parse(r.URL.Query().Get("patient_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "patient_id inválido")
		return
	}
	var delegationID *uuid.UUID
	if v := r.URL.Query().Get("delegation_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "delegation_id inválido")
			return
		}
		delegationID = &id
	}

	requesterID, _ := userIDFrom(r)
	requesterRole, _ := userRoleFrom(r)

	doc, err := s.Document.GetDocument(r.Context(), s.IPTruncate, service.GetDocumentInput{
		RequesterID:   requesterID,
		RequesterRole: requesterRole,
		PatientID:     patientID,
		DocumentID:    docID,
		DelegationID:  delegationID,
		ClientIP:      clientIPFrom(r),
		UserAgent:     r.UserAgent(),
	})
	if err != nil {
		status := http.StatusForbidden
		if errors.Is(err, service.ErrDocumentNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toDocumentResponse(doc))
}

func (s *Server) handleListMyDocuments(w http.ResponseWriter, r *http.Request) {
	patientID, _ := userIDFrom(r)
	docs, err := s.Document.ListForPatient(r.Context(), patientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error listando documentos")
		return
	}
	out := make([]documentResponse, 0, len(docs))
	for i := range docs {
		out = append(out, toDocumentResponse(&docs[i]))
	}
	writeJSON(w, http.StatusOK, out)
}

type pendingIndexItemResponse struct {
	DocumentID   string `json:"document_id"`
	UploadedByID string `json:"uploaded_by_id"`
	CreatedAt    string `json:"created_at"`
}

func (s *Server) handleListPendingIndexing(w http.ResponseWriter, r *http.Request) {
	patientID, _ := userIDFrom(r)
	items, err := s.Document.ListPendingIndexing(r.Context(), patientID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error listando pendientes")
		return
	}
	out := make([]pendingIndexItemResponse, 0, len(items))
	for _, it := range items {
		out = append(out, pendingIndexItemResponse{
			DocumentID:   it.DocumentID.String(),
			UploadedByID: it.UploadedByID.String(),
			CreatedAt:    it.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	writeJSON(w, http.StatusOK, out)
}

type confirmIndexedRequest struct {
	EncryptedKeyEnvelopeSymmetricBase64 string `json:"encrypted_key_envelope_symmetric_base64,omitempty"`
}

func (s *Server) handleConfirmIndexed(w http.ResponseWriter, r *http.Request) {
	docID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}
	var req confirmIndexedRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	var symmetricEnvelope []byte
	if req.EncryptedKeyEnvelopeSymmetricBase64 != "" {
		symmetricEnvelope, err = base64.StdEncoding.DecodeString(req.EncryptedKeyEnvelopeSymmetricBase64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "encrypted_key_envelope_symmetric_base64 inválido")
			return
		}
	}
	patientID, _ := userIDFrom(r)
	if err := s.Document.ConfirmIndexed(r.Context(), patientID, docID, symmetricEnvelope); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrDocumentNotFound) {
			status = http.StatusNotFound
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"confirmed": true})
}

func decodeHexLabel(s string) ([]byte, error) {
	if len(s) != 64 { // HMAC-SHA256 = 32 bytes = 64 hex chars
		return nil, errors.New("longitud de etiqueta inválida")
	}
	return hex.DecodeString(s)
}
