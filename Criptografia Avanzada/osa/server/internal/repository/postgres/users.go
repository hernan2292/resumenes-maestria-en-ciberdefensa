package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/google/uuid"

	"github.com/osa-project/server/internal/domain"
)

var ErrNotFound = errors.New("no encontrado")

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	if u.PublicCode == "" {
		code, err := GeneratePublicCode()
		if err != nil {
			return err
		}
		u.PublicCode = code
	}
	return r.pool.QueryRow(ctx, `
		INSERT INTO users (email, public_code, medical_license, role, auth_password_hash, kdf_salt, public_key, signing_public_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`, u.Email, u.PublicCode, u.MedicalLicense, u.Role, u.AuthPasswordHash, u.KDFSalt, u.PublicKey, u.SigningPublicKey,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(
		&u.ID, &u.Email, &u.PublicCode, &u.MedicalLicense, &u.Role, &u.AuthPasswordHash, &u.KDFSalt,
		&u.PublicKey, &u.SigningPublicKey, &u.TOTPSecretEnc, &u.TOTPEnabled,
		&u.FailedLoginCount, &u.LockedUntil, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

const userColumns = `id, email, public_code, medical_license, role, auth_password_hash, kdf_salt,
	public_key, signing_public_key, totp_secret_enc, totp_enabled,
	failed_login_count, locked_until, created_at, updated_at`

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email)
	return scanUser(row)
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
	return scanUser(row)
}

// GetByPublicCode es el único mecanismo de lookup cruzado entre paciente y
// médico (adenda punto 15): nunca se busca por email para evitar
// enumeración/harvesting de direcciones de correo de una plataforma de
// salud.
func (r *UserRepository) GetByPublicCode(ctx context.Context, code string) (*domain.User, error) {
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE public_code = $1`, code)
	return scanUser(row)
}

// GetPublicKeys retorna sólo lo que un tercero (médico buscando a un
// paciente, o viceversa) tiene derecho a ver: nunca auth_password_hash ni
// kdf_salt de otro usuario.
func (r *UserRepository) GetPublicKeys(ctx context.Context, id uuid.UUID) (publicKey, signingPublicKey []byte, err error) {
	err = r.pool.QueryRow(ctx, `SELECT public_key, signing_public_key FROM users WHERE id = $1`, id).
		Scan(&publicKey, &signingPublicKey)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	return publicKey, signingPublicKey, err
}

func (r *UserRepository) RegisterFailedLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET failed_login_count = failed_login_count + 1, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *UserRepository) SetLockedUntil(ctx context.Context, id uuid.UUID, until time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET locked_until = $2, updated_at = NOW() WHERE id = $1`, id, until)
	return err
}

func (r *UserRepository) ResetFailedLogin(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *UserRepository) SetTOTP(ctx context.Context, id uuid.UUID, encryptedSecret []byte, enabled bool) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET totp_secret_enc = $2, totp_enabled = $3, updated_at = NOW() WHERE id = $1`, id, encryptedSecret, enabled)
	return err
}

// RekeyIdentity reemplaza las claves públicas del paciente tras una
// rotación de clave maestra (Flujo B de la spec, Sección 4.2). El llamador
// (delegation_service) es responsable de revocar todas las delegaciones
// activas del paciente en la MISMA transacción lógica, dado que las claves
// viejas quedan matemáticamente inservibles de todos modos.
func (r *UserRepository) RekeyIdentity(ctx context.Context, id uuid.UUID, newPublicKey, newSigningPublicKey []byte, newAuthPasswordHash string, newKDFSalt []byte) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE users
		SET public_key = $2, signing_public_key = $3, auth_password_hash = $4, kdf_salt = $5, updated_at = NOW()
		WHERE id = $1
	`, id, newPublicKey, newSigningPublicKey, newAuthPasswordHash, newKDFSalt)
	return err
}
