package service

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
)

var (
	ErrUnauthorizedAccess  = errors.New("delegación expirada, revocada o inválida")
	ErrInvalidSignature    = errors.New("firma del paciente inválida")
	ErrDurationTooLong     = errors.New("la duración de la delegación excede el máximo permitido (120 minutos)")
	ErrInvalidTimeWindow   = errors.New("ventana de tiempo inválida")
)

type DelegationService struct {
	delegations *postgres.DelegationRepository
	users       *postgres.UserRepository
	audit       *postgres.AuditRepository
}

func NewDelegationService(d *postgres.DelegationRepository, u *postgres.UserRepository, a *postgres.AuditRepository) *DelegationService {
	return &DelegationService{delegations: d, users: u, audit: a}
}

type CreateDelegationInput struct {
	PatientID              uuid.UUID
	DoctorID               uuid.UUID
	Scope                  string
	ScopeLabel             []byte // nil si Scope == "all"
	EncryptedKeysForDoctor []byte
	ValidFrom              time.Time
	ValidUntil             time.Time
	PatientSignature       []byte
}

// CanonicalSigningMessage arma el mensaje que el paciente firma con su
// SK_sig_pac (Ed25519) en el navegador. Incluir 'scope' y 'scopeLabel' en
// el mensaje firmado (a diferencia del ejemplo de la Sección 6.2, que sólo
// firmaba patientId|doctorId|fechas|claves) evita que un servidor
// malicioso o comprometido pueda alterar el alcance de una delegación ya
// firmada sin invalidar la firma.
func CanonicalSigningMessage(in CreateDelegationInput) []byte {
	scopeLabelHex := ""
	if in.ScopeLabel != nil {
		scopeLabelHex = fmt.Sprintf("%x", in.ScopeLabel)
	}
	msg := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		in.PatientID.String(),
		in.DoctorID.String(),
		in.Scope,
		scopeLabelHex,
		in.ValidFrom.UTC().Format(time.RFC3339),
		in.ValidUntil.UTC().Format(time.RFC3339),
		base64.StdEncoding.EncodeToString(in.EncryptedKeysForDoctor),
	)
	return []byte(msg)
}

func (s *DelegationService) Create(ctx context.Context, in CreateDelegationInput) (*domain.AccessDelegation, error) {
	if !in.ValidUntil.After(in.ValidFrom) {
		return nil, ErrInvalidTimeWindow
	}
	if in.ValidUntil.Sub(in.ValidFrom) > domain.MaxDelegationDuration {
		return nil, ErrDurationTooLong
	}
	// Tolerancia de reloj de 2 minutos para no rechazar por drift de reloj
	// cliente/servidor, pero no se acepta un ValidFrom muy en el pasado
	// (evita "recalentar" delegaciones viejas) ni muy en el futuro.
	now := time.Now()
	if in.ValidFrom.Before(now.Add(-2*time.Minute)) || in.ValidFrom.After(now.Add(2*time.Minute)) {
		return nil, ErrInvalidTimeWindow
	}

	patient, err := s.users.GetByID(ctx, in.PatientID)
	if err != nil {
		return nil, fmt.Errorf("paciente no encontrado: %w", err)
	}
	if patient.Role != domain.RolePatient {
		return nil, fmt.Errorf("el emisor de la delegación debe ser un paciente")
	}
	doctor, err := s.users.GetByID(ctx, in.DoctorID)
	if err != nil {
		return nil, fmt.Errorf("médico no encontrado: %w", err)
	}
	if doctor.Role != domain.RoleDoctor && doctor.Role != domain.RoleClinicAdmin {
		return nil, fmt.Errorf("el destinatario debe ser médico o administrador de clínica")
	}

	msg := CanonicalSigningMessage(in)
	if len(patient.SigningPublicKey) != ed25519.PublicKeySize {
		return nil, ErrInvalidSignature
	}
	if !ed25519.Verify(ed25519.PublicKey(patient.SigningPublicKey), msg, in.PatientSignature) {
		return nil, ErrInvalidSignature
	}

	d := &domain.AccessDelegation{
		PatientID:              in.PatientID,
		DoctorID:               in.DoctorID,
		Scope:                  in.Scope,
		ScopeLabel:             in.ScopeLabel,
		EncryptedKeysForDoctor: in.EncryptedKeysForDoctor,
		ValidFrom:              in.ValidFrom,
		ValidUntil:             in.ValidUntil,
		PatientSignature:       in.PatientSignature,
	}
	if err := s.delegations.Create(ctx, d); err != nil {
		return nil, err
	}
	_ = s.audit.LogAccess(ctx, domain.AuditEntry{
		DelegationID: &d.ID,
		PatientID:    in.PatientID,
		AccessorID:   in.DoctorID,
		Action:       domain.AuditDelegationCreate,
	})
	return d, nil
}

func (s *DelegationService) Revoke(ctx context.Context, patientID, delegationID uuid.UUID) error {
	ok, err := s.delegations.Revoke(ctx, delegationID, patientID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrUnauthorizedAccess
	}
	_ = s.audit.LogAccess(ctx, domain.AuditEntry{
		DelegationID: &delegationID,
		PatientID:    patientID,
		AccessorID:   patientID,
		Action:       domain.AuditDelegationRevoke,
	})
	return nil
}

func (s *DelegationService) ListActiveForPatient(ctx context.Context, patientID uuid.UUID) ([]domain.AccessDelegation, error) {
	return s.delegations.ListActiveForPatient(ctx, patientID)
}

func (s *DelegationService) GetActiveForDoctor(ctx context.Context, doctorID, patientID uuid.UUID) (*domain.AccessDelegation, error) {
	return s.delegations.GetActiveForDoctor(ctx, doctorID, patientID)
}

// ValidateActive es la comprobación "Zero-Trust" central (Sección 5.3): se
// re-valida en CADA request de búsqueda o descarga, nunca se confía en el
// resultado de una validación anterior dentro de la misma sesión.
func (s *DelegationService) ValidateActive(ctx context.Context, delegationID, doctorID, patientID uuid.UUID) (*domain.AccessDelegation, error) {
	d, err := s.delegations.GetByID(ctx, delegationID)
	if err != nil || d == nil {
		return nil, ErrUnauthorizedAccess
	}
	now := time.Now().UTC()
	if d.PatientID != patientID || d.DoctorID != doctorID || d.IsRevoked ||
		now.Before(d.ValidFrom) || now.After(d.ValidUntil) {
		return nil, ErrUnauthorizedAccess
	}
	return d, nil
}
