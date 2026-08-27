package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCanonicalSigningMessage_IsDeterministic(t *testing.T) {
	in := CreateDelegationInput{
		PatientID:              uuid.New(),
		DoctorID:               uuid.New(),
		Scope:                  "cardiologia",
		ScopeLabel:             []byte{1, 2, 3},
		EncryptedKeysForDoctor: []byte{4, 5, 6, 7},
		ValidFrom:              time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC),
		ValidUntil:             time.Date(2026, 1, 1, 10, 45, 0, 0, time.UTC),
	}
	m1 := CanonicalSigningMessage(in)
	m2 := CanonicalSigningMessage(in)
	if string(m1) != string(m2) {
		t.Fatal("el mensaje canónico debe ser determinístico para las mismas entradas")
	}
}

func TestCanonicalSigningMessage_ScopeTamperingChangesMessage(t *testing.T) {
	base := CreateDelegationInput{
		PatientID:              uuid.New(),
		DoctorID:               uuid.New(),
		Scope:                  "all",
		EncryptedKeysForDoctor: []byte{1, 2, 3},
		ValidFrom:              time.Now(),
		ValidUntil:             time.Now().Add(30 * time.Minute),
	}
	tampered := base
	tampered.Scope = "cardiologia" // un atacante intentando ampliar/angostar el alcance post-firma

	if string(CanonicalSigningMessage(base)) == string(CanonicalSigningMessage(tampered)) {
		t.Fatal("cambiar el scope debe cambiar el mensaje firmado (previene tampering silencioso, ver adenda punto 2)")
	}
}

// TestCreate_RejectsOverMaxDuration ejercita el DelegationService real (sin
// mocks): la validación de duración (adenda punto 12) corre antes de
// cualquier acceso a repositorio, así que un *DelegationService{} con
// dependencias nil es suficiente para probarla end-to-end sin base de
// datos.
func TestCreate_RejectsOverMaxDuration(t *testing.T) {
	s := &DelegationService{}
	from := time.Now()
	_, err := s.Create(context.Background(), CreateDelegationInput{
		PatientID:              uuid.New(),
		DoctorID:               uuid.New(),
		Scope:                  "all",
		EncryptedKeysForDoctor: []byte{1},
		ValidFrom:              from,
		ValidUntil:             from.Add(121 * time.Minute),
		PatientSignature:       []byte{1},
	})
	if !errors.Is(err, ErrDurationTooLong) {
		t.Fatalf("esperaba ErrDurationTooLong, got %v", err)
	}
}

func TestCreate_RejectsInvertedTimeWindow(t *testing.T) {
	s := &DelegationService{}
	from := time.Now()
	_, err := s.Create(context.Background(), CreateDelegationInput{
		PatientID:              uuid.New(),
		DoctorID:               uuid.New(),
		EncryptedKeysForDoctor: []byte{1},
		ValidFrom:              from,
		ValidUntil:             from.Add(-1 * time.Minute),
		PatientSignature:       []byte{1},
	})
	if !errors.Is(err, ErrInvalidTimeWindow) {
		t.Fatalf("esperaba ErrInvalidTimeWindow, got %v", err)
	}
}

func TestCreate_RejectsValidFromTooFarInPast(t *testing.T) {
	s := &DelegationService{}
	from := time.Now().Add(-1 * time.Hour)
	_, err := s.Create(context.Background(), CreateDelegationInput{
		PatientID:              uuid.New(),
		DoctorID:               uuid.New(),
		EncryptedKeysForDoctor: []byte{1},
		ValidFrom:              from,
		ValidUntil:             from.Add(30 * time.Minute),
		PatientSignature:       []byte{1},
	})
	if !errors.Is(err, ErrInvalidTimeWindow) {
		t.Fatalf("esperaba ErrInvalidTimeWindow por ValidFrom muy en el pasado, got %v", err)
	}
}
