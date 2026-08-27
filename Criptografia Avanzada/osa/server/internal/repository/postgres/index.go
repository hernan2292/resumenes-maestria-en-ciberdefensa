package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"

	"github.com/osa-project/server/internal/domain"
)

type IndexRepository struct {
	pool *pgxpool.Pool
}

func NewIndexRepository(pool *pgxpool.Pool) *IndexRepository {
	return &IndexRepository{pool: pool}
}

// FindByPatientAndLabel es el corazón del motor SSE-2: lookup directo por
// clave primaria (patient_id, lookup_label), O(1) amortizado vía índice
// B-Tree. Retorna (nil, nil) si no hay coincidencia — "búsqueda ciega sin
// resultados" no debe distinguirse de un error para no filtrar información
// por canal lateral de timing/errores.
func (r *IndexRepository) FindByPatientAndLabel(ctx context.Context, patientID uuid.UUID, label []byte) (*domain.SSEIndexEntry, error) {
	var e domain.SSEIndexEntry
	e.PatientID = patientID
	e.LookupLabel = label
	err := r.pool.QueryRow(ctx, `
		SELECT encrypted_posting_list, updated_at FROM sse_patient_index
		WHERE patient_id = $1 AND lookup_label = $2
	`, patientID, label).Scan(&e.EncryptedPostingList, &e.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// Upsert agrega/reemplaza la posting list cifrada de una etiqueta. El
// cliente es responsable de fusionar la lista vieja+nueva antes de cifrar
// (el servidor nunca ve el contenido de la lista para poder fusionarlo él
// mismo).
func (r *IndexRepository) Upsert(ctx context.Context, patientID uuid.UUID, label, encryptedPostingList []byte) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO sse_patient_index (patient_id, lookup_label, encrypted_posting_list, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (patient_id, lookup_label)
		DO UPDATE SET encrypted_posting_list = EXCLUDED.encrypted_posting_list, updated_at = NOW()
	`, patientID, label, encryptedPostingList)
	return err
}

// ReplaceAllForPatient se usa en la rotación de clave maestra (Flujo B): el
// cliente descarga todo, re-cifra con las nuevas claves, y sube el lote
// completo dentro de una transacción atómica (todo o nada).
func (r *IndexRepository) ReplaceAllForPatient(ctx context.Context, tx pgx.Tx, patientID uuid.UUID, entries []domain.SSEIndexEntry) error {
	if _, err := tx.Exec(ctx, `DELETE FROM sse_patient_index WHERE patient_id = $1`, patientID); err != nil {
		return err
	}
	for _, e := range entries {
		if _, err := tx.Exec(ctx, `
			INSERT INTO sse_patient_index (patient_id, lookup_label, encrypted_posting_list, updated_at)
			VALUES ($1, $2, $3, NOW())
		`, patientID, e.LookupLabel, e.EncryptedPostingList); err != nil {
			return err
		}
	}
	return nil
}

func (r *IndexRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}
