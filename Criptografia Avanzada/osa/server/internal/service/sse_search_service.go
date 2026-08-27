package service

import (
	"context"
	"encoding/hex"
	"errors"

	"github.com/google/uuid"

	ossocrypto "github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
)

var ErrInvalidTrapdoor = errors.New("codificación de trapdoor inválida")

type SSESearchService struct {
	index       *postgres.IndexRepository
	delegations *postgres.DelegationRepository
	audit       *postgres.AuditRepository
	ipTruncate  bool
}

func NewSSESearchService(index *postgres.IndexRepository, delegations *postgres.DelegationRepository, audit *postgres.AuditRepository, ipTruncate bool) *SSESearchService {
	return &SSESearchService{index: index, delegations: delegations, audit: audit, ipTruncate: ipTruncate}
}

// LabelResult expone si hubo match y, de haberlo, la posting list TODAVÍA
// CIFRADA (ver adenda punto 14): este servicio nunca descifra ni resuelve
// IDs de documento, sólo hace el lookup ciego L_w -> blob.
type LabelResult struct {
	LabelHex   string
	HasMatch   bool
	Ciphertext []byte
}

type SearchBatchInput struct {
	RequesterID   uuid.UUID
	RequesterRole domain.UserRole
	PatientID     uuid.UUID
	DelegationID  *uuid.UUID // nil cuando el paciente busca su propio historial
	LabelsHex     []string   // incluye trapdoors reales + señuelo (adenda punto 8); el
	// servidor los trata exactamente igual, no puede (ni debe) distinguirlos.
	ClientIP  string
	UserAgent string
}

// SearchBatch ejecuta el lookup para un lote de trapdoors. Para búsquedas
// delegadas (médico), revalida la delegación en cada llamada (Zero-Trust,
// Sección 5.3) — nunca se cachea "ya la validé antes" en memoria del
// servidor entre requests.
func (s *SSESearchService) SearchBatch(ctx context.Context, in SearchBatchInput) ([]LabelResult, error) {
	var delegation *domain.AccessDelegation
	if in.RequesterRole != domain.RolePatient {
		if in.DelegationID == nil {
			return nil, ErrUnauthorizedAccess
		}
		d, err := s.delegations.GetByID(ctx, *in.DelegationID)
		if err != nil || d == nil {
			return nil, ErrUnauthorizedAccess
		}
		if err := validateDelegationWindow(d, in.RequesterID, in.PatientID); err != nil {
			return nil, err
		}
		delegation = d
	} else if in.RequesterID != in.PatientID {
		return nil, ErrUnauthorizedAccess
	}

	ip := in.ClientIP
	if s.ipTruncate {
		ip = ossocrypto.TruncateIP(ip)
	}

	results := make([]LabelResult, 0, len(in.LabelsHex))
	for _, labelHex := range in.LabelsHex {
		labelBytes, err := hex.DecodeString(labelHex)
		if err != nil || len(labelBytes) != 32 {
			return nil, ErrInvalidTrapdoor
		}

		entry, err := s.index.FindByPatientAndLabel(ctx, in.PatientID, labelBytes)
		if err != nil {
			return nil, err
		}

		var delegationIDPtr *uuid.UUID
		if delegation != nil {
			delegationIDPtr = &delegation.ID
		}
		// trapdoor_hash trunca el label a 8 bytes: suficiente para
		// correlacionar auditoría sin reconstruir la palabra buscada
		// (Sección 5.1 / adenda punto 11).
		_ = s.audit.LogAccess(ctx, domain.AuditEntry{
			DelegationID: delegationIDPtr,
			PatientID:    in.PatientID,
			AccessorID:   in.RequesterID,
			Action:       domain.AuditSearchQuery,
			TrapdoorHash: hex.EncodeToString(labelBytes[:8]),
			ClientIP:     ip,
			UserAgent:    in.UserAgent,
		})

		if entry == nil {
			results = append(results, LabelResult{LabelHex: labelHex, HasMatch: false})
			continue
		}
		results = append(results, LabelResult{LabelHex: labelHex, HasMatch: true, Ciphertext: entry.EncryptedPostingList})
	}
	return results, nil
}

type UpsertIndexInput struct {
	RequesterID   uuid.UUID
	RequesterRole domain.UserRole
	PatientID     uuid.UUID
	// DelegationID: requerido cuando RequesterRole != patient. Un médico
	// sólo puede escribir en el índice de un paciente mientras sostiene una
	// delegación activa para él (adenda punto 16) — es justo lo que le da
	// legítimamente K_idx para calcular trapdoors reales.
	DelegationID         *uuid.UUID
	LookupLabel          []byte
	EncryptedPostingList []byte
}

// UpsertIndex se invoca al indexar un documento nuevo (el cliente ya
// fusionó la posting list vieja+nueva antes de cifrar, ver
// internal/repository/postgres/index.go). Permitido para el propio
// paciente siempre, o para un médico/clínica con delegación activa y
// vigente sobre ese paciente (adenda punto 16).
func (s *SSESearchService) UpsertIndex(ctx context.Context, in UpsertIndexInput) error {
	if len(in.LookupLabel) != 32 {
		return ErrInvalidTrapdoor
	}
	if in.RequesterRole == domain.RolePatient {
		if in.RequesterID != in.PatientID {
			return ErrUnauthorizedAccess
		}
	} else {
		if in.DelegationID == nil {
			return ErrUnauthorizedAccess
		}
		d, err := s.delegations.GetByID(ctx, *in.DelegationID)
		if err != nil || d == nil {
			return ErrUnauthorizedAccess
		}
		if err := validateDelegationWindow(d, in.RequesterID, in.PatientID); err != nil {
			return err
		}
	}
	return s.index.Upsert(ctx, in.PatientID, in.LookupLabel, in.EncryptedPostingList)
}
