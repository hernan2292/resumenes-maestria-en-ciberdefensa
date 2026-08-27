package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	ossocrypto "github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
)

var (
	ErrNotAuthorizedToUpload = errors.New("no autorizado para subir documentos a este paciente")
	ErrNotAuthorizedToRead   = errors.New("no autorizado para acceder a este documento")
	ErrDocumentNotFound      = errors.New("documento no encontrado")
)

// maxPaddedBlobSize es un tope defensivo (128MB) para el tamaño de un blob
// ya con padding aplicado, no un límite clínico real; evita que un cliente
// autenticado pero comprometido agote disco con un solo POST.
const maxPaddedBlobSize = 128 * 1024 * 1024

type DocumentService struct {
	documents   *postgres.DocumentRepository
	users       *postgres.UserRepository
	delegations *postgres.DelegationRepository
	scopeLabels *postgres.ScopeLabelRepository
	audit       *postgres.AuditRepository
}

func NewDocumentService(
	documents *postgres.DocumentRepository,
	users *postgres.UserRepository,
	delegations *postgres.DelegationRepository,
	scopeLabels *postgres.ScopeLabelRepository,
	audit *postgres.AuditRepository,
) *DocumentService {
	return &DocumentService{documents: documents, users: users, delegations: delegations, scopeLabels: scopeLabels, audit: audit}
}

type UploadInput struct {
	UploaderID           uuid.UUID
	UploaderRole         domain.UserRole
	PatientID            uuid.UUID
	TitleEncrypted       []byte
	DocTypeEncrypted     []byte
	EncryptedBlob        []byte // ya con padding a bloques de 64KiB aplicado en el cliente
	EncryptedKeyEnvelope []byte
	// EncryptedKeyEnvelopeSymmetric: opcional — presente cuando quien sube
	// tenía K_enc en ese momento (adenda punto 16). Habilita lectura rápida
	// para futuros médicos delegados sin depender de SK_pac.
	EncryptedKeyEnvelopeSymmetric []byte
	ScopeLabels                   [][]byte // HMAC opacos, calculados en el cliente (adenda punto 2)
	// NeedsIndexing: true si quien sube no tenía K_idx en ese momento (no
	// pudo calcular trapdoors reales) — ver adenda punto 16.
	NeedsIndexing bool
}

// Upload implementa el Flujo A (Sección 4.1): un médico/clínica sube un
// documento cifrado directamente para el paciente usando PK_pac (obtenida
// antes vía GetPublicKey), sin necesitar una delegación de LECTURA activa
// — subir y leer son permisos distintos por diseño. Un paciente también
// puede auto-subir documentos externos.
func (s *DocumentService) Upload(ctx context.Context, in UploadInput) (*domain.MedicalDocument, error) {
	if in.UploaderRole == domain.RolePatient && in.UploaderID != in.PatientID {
		return nil, ErrNotAuthorizedToUpload
	}
	if in.UploaderRole != domain.RolePatient && in.UploaderRole != domain.RoleDoctor && in.UploaderRole != domain.RoleClinicAdmin {
		return nil, ErrNotAuthorizedToUpload
	}
	if len(in.EncryptedBlob) == 0 || len(in.EncryptedBlob) > maxPaddedBlobSize {
		return nil, fmt.Errorf("tamaño de blob inválido")
	}
	if len(in.EncryptedBlob)%(64*1024) != 0 {
		// Refuerza en el servidor la política de padding de la Sección 7.4:
		// si el tamaño no es múltiplo de 64KiB, el cliente no aplicó el
		// padding anti-inferencia correctamente y se rechaza el upload.
		return nil, fmt.Errorf("el blob cifrado debe tener padding a múltiplos de 64KiB (anti-inferencia de tamaño)")
	}

	patient, err := s.users.GetByID(ctx, in.PatientID)
	if err != nil || patient.Role != domain.RolePatient {
		return nil, fmt.Errorf("paciente destino inválido")
	}

	d := &domain.MedicalDocument{
		PatientID:                     in.PatientID,
		UploadedByID:                  in.UploaderID,
		TitleEncrypted:                in.TitleEncrypted,
		DocTypeEncrypted:              in.DocTypeEncrypted,
		EncryptedBlob:                 in.EncryptedBlob,
		EncryptedKeyEnvelope:          in.EncryptedKeyEnvelope,
		EncryptedKeyEnvelopeSymmetric: in.EncryptedKeyEnvelopeSymmetric,
		FileSizeBytes:                 int64(len(in.EncryptedBlob)),
		NeedsIndexing:                 in.NeedsIndexing,
	}
	if err := s.documents.Create(ctx, d); err != nil {
		return nil, err
	}
	if len(in.ScopeLabels) > 0 {
		if err := s.scopeLabels.AttachLabels(ctx, d.ID, in.PatientID, in.ScopeLabels); err != nil {
			return nil, err
		}
	}

	_ = s.audit.LogAccess(ctx, domain.AuditEntry{
		PatientID:  in.PatientID,
		AccessorID: in.UploaderID,
		Action:     domain.AuditUpload,
	})
	return d, nil
}

type GetDocumentInput struct {
	RequesterID   uuid.UUID
	RequesterRole domain.UserRole
	PatientID     uuid.UUID
	DocumentID    uuid.UUID
	DelegationID  *uuid.UUID // requerido si RequesterRole != patient
	ClientIP      string
	UserAgent     string
}

// GetDocument aplica el paso 3 del flujo corregido en la adenda (punto 14):
// la resolución de la posting list ocurre en el cliente; este método es el
// único lugar donde el servidor decide si entrega bytes cifrados de un
// documento puntual, y por lo tanto el único lugar donde el "scope" de una
// delegación restringida se hace cumplir de verdad.
func (s *DocumentService) GetDocument(ctx context.Context, ipTruncate bool, in GetDocumentInput) (*domain.EncryptedDocumentResult, error) {
	if in.RequesterRole == domain.RolePatient {
		if in.RequesterID != in.PatientID {
			return nil, ErrNotAuthorizedToRead
		}
	} else {
		if in.DelegationID == nil {
			return nil, ErrNotAuthorizedToRead
		}
		delegation, err := s.delegations.GetByID(ctx, *in.DelegationID)
		if err != nil || delegation == nil {
			return nil, ErrUnauthorizedAccess
		}
		if err := validateDelegationWindow(delegation, in.RequesterID, in.PatientID); err != nil {
			return nil, err
		}
		if delegation.Scope != "all" && delegation.ScopeLabel != nil {
			hasLabel, err := s.scopeLabels.HasLabel(ctx, in.DocumentID, delegation.ScopeLabel)
			if err != nil {
				return nil, err
			}
			if !hasLabel {
				return nil, ErrNotAuthorizedToRead
			}
		}
	}

	doc, err := s.documents.GetByID(ctx, in.PatientID, in.DocumentID)
	if err != nil {
		return nil, ErrDocumentNotFound
	}

	ip := in.ClientIP
	if ipTruncate {
		ip = ossocrypto.TruncateIP(ip)
	}
	_ = s.audit.LogAccess(ctx, domain.AuditEntry{
		DelegationID: in.DelegationID,
		PatientID:    in.PatientID,
		AccessorID:   in.RequesterID,
		Action:       domain.AuditDocumentDownload,
		ClientIP:     ip,
		UserAgent:    in.UserAgent,
	})
	return doc, nil
}

func (s *DocumentService) ListForPatient(ctx context.Context, patientID uuid.UUID) ([]domain.EncryptedDocumentResult, error) {
	return s.documents.ListByPatient(ctx, patientID)
}

func (s *DocumentService) ListPendingIndexing(ctx context.Context, patientID uuid.UUID) ([]domain.PendingIndexItem, error) {
	return s.documents.ListPendingIndexing(ctx, patientID)
}

func (s *DocumentService) ConfirmIndexed(ctx context.Context, patientID, documentID uuid.UUID, symmetricEnvelope []byte) error {
	ok, err := s.documents.ConfirmIndexed(ctx, patientID, documentID, symmetricEnvelope)
	if err != nil {
		return err
	}
	if !ok {
		return ErrDocumentNotFound
	}
	return nil
}

func validateDelegationWindow(d *domain.AccessDelegation, doctorID, patientID uuid.UUID) error {
	if d.PatientID != patientID || d.DoctorID != doctorID || d.IsRevoked {
		return ErrUnauthorizedAccess
	}
	now := time.Now().UTC()
	if now.Before(d.ValidFrom) || now.After(d.ValidUntil) {
		return ErrUnauthorizedAccess
	}
	return nil
}
