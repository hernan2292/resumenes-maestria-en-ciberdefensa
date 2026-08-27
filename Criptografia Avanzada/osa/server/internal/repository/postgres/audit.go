package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v4/pgxpool"

	"github.com/osa-project/server/internal/domain"
)

type AuditRepository struct {
	pool *pgxpool.Pool
}

func NewAuditRepository(pool *pgxpool.Pool) *AuditRepository {
	return &AuditRepository{pool: pool}
}

// LogAccess inserta una fila inmutable. No hay método Update ni Delete en
// este repositorio a propósito: a nivel de aplicación el log es append-only
// (ver también la recomendación de revocar privilegios UPDATE/DELETE a
// nivel de rol de base de datos en migrations/0001_init.sql).
func (r *AuditRepository) LogAccess(ctx context.Context, e domain.AuditEntry) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO medical_access_audit_logs
			(delegation_id, patient_id, accessor_id, action, trapdoor_hash, client_ip, user_agent, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
	`, e.DelegationID, e.PatientID, e.AccessorID, e.Action, e.TrapdoorHash, e.ClientIP, e.UserAgent)
	return err
}

// ListForPatient alimenta una futura vista "quién accedió a mi historial y
// cuándo" en el portal del paciente — transparencia total es parte del
// modelo de confianza de una plataforma de salud zero-knowledge.
func (r *AuditRepository) ListForPatient(ctx context.Context, patientID uuid.UUID, limit int) ([]domain.AuditEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, delegation_id, patient_id, accessor_id, action, trapdoor_hash, client_ip, user_agent, timestamp
		FROM medical_access_audit_logs
		WHERE patient_id = $1
		ORDER BY timestamp DESC
		LIMIT $2
	`, patientID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.AuditEntry
	for rows.Next() {
		var e domain.AuditEntry
		if err := rows.Scan(&e.ID, &e.DelegationID, &e.PatientID, &e.AccessorID, &e.Action, &e.TrapdoorHash, &e.ClientIP, &e.UserAgent, &e.Timestamp); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
