// Package domain contiene los modelos de negocio del sistema. El servidor
// es un "custodio ciego": ningún tipo aquí contiene texto clínico en claro,
// salvo metadatos estrictamente operativos (fechas, IDs, tamaños).
package domain

import (
	"time"

	"github.com/google/uuid"
)

// UserRole define los roles soportados. No existe rol "admin" con acceso a
// datos clínicos de terceros: un clinic_admin gestiona altas de médicos de
// su institución pero no obtiene automáticamente acceso a historiales.
type UserRole string

const (
	RolePatient     UserRole = "patient"
	RoleDoctor      UserRole = "doctor"
	RoleClinicAdmin UserRole = "clinic_admin"
)

func (r UserRole) Valid() bool {
	switch r {
	case RolePatient, RoleDoctor, RoleClinicAdmin:
		return true
	}
	return false
}

// User representa una fila de la tabla users. auth_password_hash es un
// Argon2id calculado en el SERVIDOR únicamente para autenticar la sesión
// HTTP; es criptográficamente independiente de las claves de cifrado que el
// paciente deriva en su navegador a partir de la misma contraseña (ver
// docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md #13).
type User struct {
	ID                uuid.UUID
	Email             string
	PublicCode        string // identificador público no adivinable, para lookup cruzado sin exponer el email (adenda punto 15)
	MedicalLicense    *string
	Role              UserRole
	AuthPasswordHash  string
	KDFSalt           []byte
	PublicKey         []byte // X25519, 32 bytes
	SigningPublicKey  []byte // Ed25519, 32 bytes
	TOTPSecretEnc     []byte // secreto TOTP cifrado con clave del servidor (KMS/env), null si no activado
	TOTPEnabled       bool
	FailedLoginCount  int
	LockedUntil       *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// MedicalDocument es un blob cifrado; el servidor nunca ve título, tipo de
// documento ni contenido en claro. doc_type ahora viaja cifrado (ver adenda
// punto 1): antes de esta corrección el campo original iba en texto plano y
// filtraba metadatos clínicos sensibles.
type MedicalDocument struct {
	ID                   uuid.UUID
	PatientID            uuid.UUID
	UploadedByID         uuid.UUID
	TitleEncrypted       []byte
	DocTypeEncrypted     []byte // antes: doc_type VARCHAR en claro
	EncryptedBlob        []byte // IV(12) || ciphertext || tag, con padding a bloques de 64KiB
	EncryptedKeyEnvelope []byte // K_doc envuelta con ECIES para PK_pac; SIEMPRE presente (adenda punto 16)
	// EncryptedKeyEnvelopeSymmetric: la MISMA K_doc envuelta con AES-GCM
	// bajo K_enc; nil si quien subió el documento no tenía K_enc en ese
	// momento. Es el camino que permite a un médico delegado leer el
	// documento sin depender de SK_pac (adenda punto 16).
	EncryptedKeyEnvelopeSymmetric []byte
	FileSizeBytes                 int64 // tamaño tras padding, no el tamaño real
	// NeedsIndexing: true si quien subió el documento no tenía K_idx en ese
	// momento (no pudo calcular trapdoors reales). El propio paciente lo
	// procesa después (adenda punto 16).
	NeedsIndexing bool
	CreatedAt     time.Time
}

// DocumentKeyEnvelopeUpdate es el re-empaquetado de encrypted_key_envelope
// de UN documento existente durante una rotación de identidad X25519 (Flujo
// B / adenda punto 19): el cliente descifra la K_doc vieja con la SK_pac
// vieja y la re-envuelve con ECIES para la PK_pac nueva. Sin este paso, subir
// una identidad nueva dejaría indescifrable para siempre cualquier documento
// cuyo único sobre dependa de la identidad vieja.
type DocumentKeyEnvelopeUpdate struct {
	DocumentID           uuid.UUID
	EncryptedKeyEnvelope []byte
}

// PendingIndexItem es lo que el portal del paciente lista para saber qué
// documentos todavía no están indexados con trapdoors reales.
type PendingIndexItem struct {
	DocumentID   uuid.UUID
	UploadedByID uuid.UUID
	CreatedAt    time.Time
}

// SSEIndexEntry es una fila del índice invertido cifrado del paciente.
type SSEIndexEntry struct {
	PatientID           uuid.UUID
	LookupLabel         []byte // L_w = HMAC-SHA256(K_idx, w || 1)
	EncryptedPostingList []byte
	UpdatedAt           time.Time
}

// DocumentScopeLabel asocia un documento con una etiqueta de alcance opaca
// (HMAC de la categoría clínica bajo K_idx). Permite que el servidor filtre
// resultados por especialidad en una delegación restringida SIN conocer la
// categoría real (ver adenda punto 2).
type DocumentScopeLabel struct {
	DocumentID uuid.UUID
	PatientID  uuid.UUID
	ScopeLabel []byte
}

// AccessDelegation es el Ticket Criptográfico de Delegación Temporal (TCDT).
type AccessDelegation struct {
	ID                     uuid.UUID
	PatientID              uuid.UUID
	DoctorID               uuid.UUID
	Scope                  string  // etiqueta legible sólo para UI ("all" o nombre libre elegido por el paciente)
	ScopeLabel             []byte  // nil si Scope == "all"; si no, HMAC opaco (ver DocumentScopeLabel)
	EncryptedKeysForDoctor []byte  // Enc_{PK_doc}(K_idx || K_enc)
	ValidFrom              time.Time
	ValidUntil             time.Time
	PatientSignature       []byte // Ed25519 sobre el resto de los campos
	IsRevoked              bool
	CreatedAt              time.Time
}

// MaxDelegationDuration es el tope duro de la Sección 7.1 de la spec,
// validado en el servidor (adenda punto 12), no sólo sugerido en la UI.
const MaxDelegationDuration = 120 * time.Minute

type AuditAction string

const (
	AuditSearchQuery      AuditAction = "SEARCH_QUERY"
	AuditDocumentDownload AuditAction = "DOCUMENT_DOWNLOAD"
	AuditUpload           AuditAction = "UPLOAD"
	AuditLoginSuccess     AuditAction = "LOGIN_SUCCESS"
	AuditLoginFailed      AuditAction = "LOGIN_FAILED"
	AuditLoginLocked      AuditAction = "LOGIN_LOCKED"
	AuditDelegationCreate AuditAction = "DELEGATION_CREATE"
	AuditDelegationRevoke AuditAction = "DELEGATION_REVOKE"
	AuditRekey            AuditAction = "REKEY"
)

type AuditEntry struct {
	ID           int64
	DelegationID *uuid.UUID
	PatientID    uuid.UUID
	AccessorID   uuid.UUID
	Action       AuditAction
	TrapdoorHash string // truncado, nunca revela la palabra buscada
	ClientIP     string // truncado según AUDIT_IP_TRUNCATE (ver adenda punto 7)
	UserAgent    string
	Timestamp    time.Time
}

type EncryptedDocumentResult struct {
	ID                            uuid.UUID
	UploadedByID                  uuid.UUID
	TitleEncrypted                []byte
	DocTypeEncrypted              []byte
	EncryptedBlob                 []byte
	EncryptedKeyEnvelope          []byte
	EncryptedKeyEnvelopeSymmetric []byte // nil si no fue subido/backfillado con K_enc disponible
	CreatedAt                     time.Time
}
