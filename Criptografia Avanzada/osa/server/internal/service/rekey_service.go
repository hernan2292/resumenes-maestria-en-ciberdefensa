package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
)

// RekeyService implementa el Flujo B (Sección 4.2): rotación soberana de
// clave maestra. El efecto criptográfico deseado —revocación perfecta
// retroactiva de todas las delegaciones— ya ocurre solo porque las claves
// viejas dejan de servir para nada; este servicio además marca
// explícitamente is_revoked=TRUE (adenda, nota en delegations.go) para que
// la UI y la auditoría sean legibles sin tener que "adivinar" que un
// ticket viejo es inútil.
type RekeyService struct {
	users       *postgres.UserRepository
	index       *postgres.IndexRepository
	delegations *postgres.DelegationRepository
	documents   *postgres.DocumentRepository
	audit       *postgres.AuditRepository
}

func NewRekeyService(users *postgres.UserRepository, index *postgres.IndexRepository, delegations *postgres.DelegationRepository, documents *postgres.DocumentRepository, audit *postgres.AuditRepository) *RekeyService {
	return &RekeyService{users: users, index: index, delegations: delegations, documents: documents, audit: audit}
}

type RekeyInput struct {
	PatientID           uuid.UUID
	NewPassword         string
	NewKDFSalt          []byte
	NewPublicKey        []byte
	NewSigningPublicKey []byte
	// NewIndexEntries: el índice invertido completo del paciente, re-cifrado
	// client-side con el nuevo K_idx/K_enc. Se sube atómicamente: o se
	// reemplaza todo o no se cambia nada (evita quedar con un índice mitad
	// viejo/mitad nuevo si el navegador se cierra a mitad de upload).
	NewIndexEntries []domain.SSEIndexEntry
	// NewDocumentKeyEnvelopes: encrypted_key_envelope re-envuelto client-side
	// para la PK_pac nueva, UNO por cada documento que el paciente tiene hoy
	// (adenda punto 19). Es obligatorio y se verifica que cubra exactamente
	// el conjunto de documentos existentes: la identidad X25519 vieja es lo
	// único que puede abrir el sobre asimétrico viejo, así que si se rota sin
	// re-envolver, esos documentos quedan indescifrables para siempre — ni
	// siquiera el propio paciente podría recuperarlos.
	NewDocumentKeyEnvelopes []domain.DocumentKeyEnvelopeUpdate
}

func (s *RekeyService) Rekey(ctx context.Context, in RekeyInput) error {
	if len(in.NewPublicKey) != 32 || len(in.NewSigningPublicKey) != 32 {
		return fmt.Errorf("claves públicas inválidas")
	}
	if len(in.NewKDFSalt) < 16 {
		return fmt.Errorf("kdf_salt inválido")
	}
	newHash, err := crypto.HashPassword(in.NewPassword)
	if err != nil {
		return err
	}

	tx, err := s.delegations.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Verificación de cobertura (adenda punto 19): el cliente debe haber
	// re-envuelto la K_doc de CADA documento existente antes de que se
	// invalide la identidad vieja, o quedarían huérfanos sin ningún sobre
	// descifrable.
	existingDocIDs, err := s.documents.ListDocumentIDsForPatientTx(ctx, tx, in.PatientID)
	if err != nil {
		return err
	}
	if len(in.NewDocumentKeyEnvelopes) != len(existingDocIDs) {
		return fmt.Errorf(
			"se esperaba un sobre de clave re-envuelto por cada uno de los %d documentos existentes, se recibieron %d",
			len(existingDocIDs), len(in.NewDocumentKeyEnvelopes),
		)
	}
	existingDocSet := make(map[uuid.UUID]bool, len(existingDocIDs))
	for _, id := range existingDocIDs {
		existingDocSet[id] = true
	}
	seen := make(map[uuid.UUID]bool, len(in.NewDocumentKeyEnvelopes))
	for _, u := range in.NewDocumentKeyEnvelopes {
		if !existingDocSet[u.DocumentID] {
			return fmt.Errorf("el documento %s no pertenece a este paciente", u.DocumentID)
		}
		if seen[u.DocumentID] {
			return fmt.Errorf("sobre duplicado para el documento %s", u.DocumentID)
		}
		seen[u.DocumentID] = true
	}
	if err := s.documents.RewrapKeyEnvelopesForPatient(ctx, tx, in.PatientID, in.NewDocumentKeyEnvelopes); err != nil {
		return err
	}

	if err := s.index.ReplaceAllForPatient(ctx, tx, in.PatientID, in.NewIndexEntries); err != nil {
		return err
	}
	if err := s.delegations.RevokeAllForPatient(ctx, tx, in.PatientID); err != nil {
		return err
	}
	if err := s.users.RekeyIdentity(ctx, in.PatientID, in.NewPublicKey, in.NewSigningPublicKey, newHash, in.NewKDFSalt); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	_ = s.audit.LogAccess(ctx, domain.AuditEntry{
		PatientID:  in.PatientID,
		AccessorID: in.PatientID,
		Action:     domain.AuditRekey,
	})
	return nil
}
