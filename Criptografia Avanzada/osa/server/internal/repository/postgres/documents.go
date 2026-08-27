package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"

	"github.com/osa-project/server/internal/domain"
)

type DocumentRepository struct {
	pool *pgxpool.Pool
}

func NewDocumentRepository(pool *pgxpool.Pool) *DocumentRepository {
	return &DocumentRepository{pool: pool}
}

func (r *DocumentRepository) Create(ctx context.Context, d *domain.MedicalDocument) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO medical_documents
			(patient_id, uploaded_by_id, title_encrypted, doc_type_encrypted, encrypted_blob,
			 encrypted_key_envelope, encrypted_key_envelope_symmetric, file_size_bytes, needs_indexing)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`, d.PatientID, d.UploadedByID, d.TitleEncrypted, d.DocTypeEncrypted, d.EncryptedBlob,
		d.EncryptedKeyEnvelope, d.EncryptedKeyEnvelopeSymmetric, d.FileSizeBytes, d.NeedsIndexing,
	).Scan(&d.ID, &d.CreatedAt)
}

// ListPendingIndexing alimenta GET /api/v1/patients/me/pending-index (ver
// adenda punto 16): documentos que todavía no tienen trapdoors reales en
// el índice del paciente.
func (r *DocumentRepository) ListPendingIndexing(ctx context.Context, patientID uuid.UUID) ([]domain.PendingIndexItem, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, uploaded_by_id, created_at
		FROM medical_documents
		WHERE patient_id = $1 AND needs_indexing
		ORDER BY created_at ASC
	`, patientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.PendingIndexItem
	for rows.Next() {
		var it domain.PendingIndexItem
		if err := rows.Scan(&it.DocumentID, &it.UploadedByID, &it.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// ConfirmIndexed limpia needs_indexing y, si se provee, adjunta el sobre
// simétrico que faltaba (backfill — ver adenda punto 16). ownership se
// garantiza vía patient_id en el WHERE.
func (r *DocumentRepository) ConfirmIndexed(ctx context.Context, patientID, documentID uuid.UUID, symmetricEnvelope []byte) (bool, error) {
	var tag interface{ RowsAffected() int64 }
	var err error
	if len(symmetricEnvelope) > 0 {
		res, e := r.pool.Exec(ctx, `
			UPDATE medical_documents
			SET needs_indexing = FALSE, encrypted_key_envelope_symmetric = $3
			WHERE id = $1 AND patient_id = $2
		`, documentID, patientID, symmetricEnvelope)
		tag, err = res, e
	} else {
		res, e := r.pool.Exec(ctx, `
			UPDATE medical_documents SET needs_indexing = FALSE
			WHERE id = $1 AND patient_id = $2
		`, documentID, patientID)
		tag, err = res, e
	}
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

const documentColumns = `id, uploaded_by_id, title_encrypted, doc_type_encrypted, encrypted_blob,
	encrypted_key_envelope, encrypted_key_envelope_symmetric, created_at`

// GetDocumentsByIDs sólo retorna documentos que pertenezcan a patientID:
// aunque docIDs viene de una posting list ya resuelta para ese paciente,
// esta cláusula WHERE es una segunda barrera (defensa en profundidad) ante
// cualquier bug futuro que mezcle índices entre pacientes.
func (r *DocumentRepository) GetDocumentsByIDs(ctx context.Context, patientID uuid.UUID, docIDs []uuid.UUID) ([]domain.EncryptedDocumentResult, error) {
	if len(docIDs) == 0 {
		return []domain.EncryptedDocumentResult{}, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT `+documentColumns+`
		FROM medical_documents
		WHERE patient_id = $1 AND id = ANY($2)
	`, patientID, docIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.EncryptedDocumentResult
	for rows.Next() {
		var d domain.EncryptedDocumentResult
		if err := rows.Scan(&d.ID, &d.UploadedByID, &d.TitleEncrypted, &d.DocTypeEncrypted, &d.EncryptedBlob, &d.EncryptedKeyEnvelope, &d.EncryptedKeyEnvelopeSymmetric, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *DocumentRepository) GetByID(ctx context.Context, patientID, docID uuid.UUID) (*domain.EncryptedDocumentResult, error) {
	var d domain.EncryptedDocumentResult
	err := r.pool.QueryRow(ctx, `
		SELECT `+documentColumns+`
		FROM medical_documents
		WHERE patient_id = $1 AND id = $2
	`, patientID, docID).Scan(&d.ID, &d.UploadedByID, &d.TitleEncrypted, &d.DocTypeEncrypted, &d.EncryptedBlob, &d.EncryptedKeyEnvelope, &d.EncryptedKeyEnvelopeSymmetric, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListDocumentIDsForPatientTx lista, DENTRO de la misma transacción de una
// rotación de identidad, todos los IDs de documentos de un paciente — el
// RekeyService la usa para exigir que el cliente haya mandado un sobre
// re-envuelto para cada uno antes de rotar (adenda punto 19): si faltara
// uno, ese documento quedaría permanentemente indescifrable.
func (r *DocumentRepository) ListDocumentIDsForPatientTx(ctx context.Context, tx pgx.Tx, patientID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := tx.Query(ctx, `SELECT id FROM medical_documents WHERE patient_id = $1`, patientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// RewrapKeyEnvelopesForPatient reemplaza encrypted_key_envelope de cada
// documento listado por el sobre re-cifrado client-side para la identidad
// nueva (adenda punto 19). Como en el mismo Flujo B también rota K_enc, el
// sobre simétrico viejo (cifrado bajo el K_enc anterior) deja de ser
// utilizable — en vez de dejarlo como un AEAD que fallará silenciosamente al
// intentar abrirse, se limpia junto con needs_indexing=TRUE, dejando al
// documento en el mismo estado "por indexar" que ya maneja el flujo de
// backfill existente (ver adenda punto 16 / ConfirmIndexed).
func (r *DocumentRepository) RewrapKeyEnvelopesForPatient(ctx context.Context, tx pgx.Tx, patientID uuid.UUID, updates []domain.DocumentKeyEnvelopeUpdate) error {
	for _, u := range updates {
		tag, err := tx.Exec(ctx, `
			UPDATE medical_documents
			SET encrypted_key_envelope = $1, encrypted_key_envelope_symmetric = NULL, needs_indexing = TRUE
			WHERE id = $2 AND patient_id = $3
		`, u.EncryptedKeyEnvelope, u.DocumentID, patientID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return fmt.Errorf("el documento %s no existe o no pertenece a este paciente", u.DocumentID)
		}
	}
	return nil
}

// ListByPatient retorna metadata (sin el blob pesado) para que el portal
// del paciente pueda listar su historial sin descargar todos los archivos.
func (r *DocumentRepository) ListByPatient(ctx context.Context, patientID uuid.UUID) ([]domain.EncryptedDocumentResult, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, uploaded_by_id, title_encrypted, doc_type_encrypted, '', encrypted_key_envelope, encrypted_key_envelope_symmetric, created_at
		FROM medical_documents
		WHERE patient_id = $1
		ORDER BY created_at DESC
	`, patientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.EncryptedDocumentResult
	for rows.Next() {
		var d domain.EncryptedDocumentResult
		var emptyBlob []byte
		if err := rows.Scan(&d.ID, &d.UploadedByID, &d.TitleEncrypted, &d.DocTypeEncrypted, &emptyBlob, &d.EncryptedKeyEnvelope, &d.EncryptedKeyEnvelopeSymmetric, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
