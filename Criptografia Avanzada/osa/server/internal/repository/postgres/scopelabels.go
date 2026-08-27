package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v4/pgxpool"
)

type ScopeLabelRepository struct {
	pool *pgxpool.Pool
}

func NewScopeLabelRepository(pool *pgxpool.Pool) *ScopeLabelRepository {
	return &ScopeLabelRepository{pool: pool}
}

// AttachLabels asocia un documento recién subido con 0..N etiquetas de
// alcance opacas (HMAC de categoría bajo K_idx, calculado en el cliente).
func (r *ScopeLabelRepository) AttachLabels(ctx context.Context, documentID, patientID uuid.UUID, labels [][]byte) error {
	for _, label := range labels {
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO document_scope_labels (document_id, patient_id, scope_label)
			VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING
		`, documentID, patientID, label); err != nil {
			return err
		}
	}
	return nil
}

// HasLabel indica si un documento tiene la etiqueta de alcance dada. Se usa
// para aplicar el enforcement de "scope" de una delegación restringida
// (adenda puntos 2 y 14) al momento de entregar el blob, no al buscar.
func (r *ScopeLabelRepository) HasLabel(ctx context.Context, documentID uuid.UUID, label []byte) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM document_scope_labels WHERE document_id = $1 AND scope_label = $2)
	`, documentID, label).Scan(&exists)
	return exists, err
}
