package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"

	"github.com/osa-project/server/internal/domain"
)

type DelegationRepository struct {
	pool *pgxpool.Pool
}

func NewDelegationRepository(pool *pgxpool.Pool) *DelegationRepository {
	return &DelegationRepository{pool: pool}
}

func (r *DelegationRepository) Create(ctx context.Context, d *domain.AccessDelegation) error {
	return r.pool.QueryRow(ctx, `
		INSERT INTO access_delegations
			(patient_id, doctor_id, scope, scope_label, encrypted_keys_for_doctor, valid_from, valid_until, patient_signature)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`, d.PatientID, d.DoctorID, d.Scope, d.ScopeLabel, d.EncryptedKeysForDoctor, d.ValidFrom, d.ValidUntil, d.PatientSignature,
	).Scan(&d.ID, &d.CreatedAt)
}

const delegationColumns = `id, patient_id, doctor_id, scope, scope_label, encrypted_keys_for_doctor,
	valid_from, valid_until, patient_signature, is_revoked, created_at`

func scanDelegation(row pgx.Row) (*domain.AccessDelegation, error) {
	var d domain.AccessDelegation
	err := row.Scan(
		&d.ID, &d.PatientID, &d.DoctorID, &d.Scope, &d.ScopeLabel, &d.EncryptedKeysForDoctor,
		&d.ValidFrom, &d.ValidUntil, &d.PatientSignature, &d.IsRevoked, &d.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DelegationRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.AccessDelegation, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+delegationColumns+` FROM access_delegations WHERE id = $1`, id)
	return scanDelegation(row)
}

// GetActiveForDoctor retorna la delegación vigente (no vencida, no
// revocada) más reciente entre un médico y un paciente, si existe.
func (r *DelegationRepository) GetActiveForDoctor(ctx context.Context, doctorID, patientID uuid.UUID) (*domain.AccessDelegation, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+delegationColumns+` FROM access_delegations
		WHERE doctor_id = $1 AND patient_id = $2 AND is_revoked = FALSE AND valid_until > NOW()
		ORDER BY created_at DESC
		LIMIT 1
	`, doctorID, patientID)
	return scanDelegation(row)
}

// ListActiveForPatient alimenta el "Panel de Control de Privacidad" del
// paciente (Sección 6.1.A): médicos con acceso activo y su TTL restante.
func (r *DelegationRepository) ListActiveForPatient(ctx context.Context, patientID uuid.UUID) ([]domain.AccessDelegation, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+delegationColumns+` FROM access_delegations
		WHERE patient_id = $1 AND is_revoked = FALSE AND valid_until > NOW()
		ORDER BY valid_until ASC
	`, patientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.AccessDelegation
	for rows.Next() {
		d, err := scanDelegation(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

// Revoke marca la delegación como revocada. patientID se exige en el WHERE
// para que un médico jamás pueda revocar (ni consultar el estado de) una
// delegación que no le pertenece a él como recurso del paciente.
func (r *DelegationRepository) Revoke(ctx context.Context, id, patientID uuid.UUID) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE access_delegations SET is_revoked = TRUE WHERE id = $1 AND patient_id = $2
	`, id, patientID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// RevokeAllForPatient se invoca en cada rotación de clave maestra (Flujo B,
// Sección 4.2): las claves viejas quedan matemáticamente inútiles, pero
// marcamos explícitamente is_revoked=TRUE para que el panel de privacidad y
// la auditoría reflejen la revocación de forma clara y consultable.
func (r *DelegationRepository) RevokeAllForPatient(ctx context.Context, tx pgx.Tx, patientID uuid.UUID) error {
	_, err := tx.Exec(ctx, `UPDATE access_delegations SET is_revoked = TRUE WHERE patient_id = $1 AND is_revoked = FALSE`, patientID)
	return err
}

func (r *DelegationRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.Begin(ctx)
}
