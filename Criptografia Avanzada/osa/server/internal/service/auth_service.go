package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository/postgres"
)

var (
	ErrInvalidCredentials = errors.New("credenciales inválidas")
	ErrAccountLocked      = errors.New("cuenta bloqueada temporalmente por intentos fallidos")
	ErrTOTPRequired       = errors.New("se requiere código de segundo factor")
	ErrTOTPInvalid        = errors.New("código de segundo factor inválido")
)

const (
	maxFailedLogins  = 5
	accountLockDelay = 15 * time.Minute
)

type AuthService struct {
	users     *postgres.UserRepository
	audit     *postgres.AuditRepository
	jwt       *crypto.JWTIssuer
	totp      *crypto.TOTPManager
	ipTruncate bool
}

func NewAuthService(users *postgres.UserRepository, audit *postgres.AuditRepository, jwt *crypto.JWTIssuer, totp *crypto.TOTPManager, ipTruncate bool) *AuthService {
	return &AuthService{users: users, audit: audit, jwt: jwt, totp: totp, ipTruncate: ipTruncate}
}

type RegisterInput struct {
	Email            string
	Password         string
	Role             domain.UserRole
	MedicalLicense   *string
	KDFSalt          []byte // generado en el cliente, 256 bits
	PublicKey        []byte // X25519 del cliente
	SigningPublicKey []byte // Ed25519 del cliente
}

// Register crea la cuenta. La contraseña llega aquí en claro por TLS (nunca
// se loguea ni persiste tal cual): sólo se hashea con Argon2id server-side.
// El cliente, en paralelo y de forma independiente, ya usó esa misma
// contraseña + KDFSalt para derivar SUS claves de cifrado ANTES de este
// llamado — el servidor jamás ve esas claves (ver adenda punto 13).
func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*domain.User, error) {
	if !in.Role.Valid() {
		return nil, fmt.Errorf("rol inválido")
	}
	if in.Role == domain.RoleDoctor && in.MedicalLicense == nil {
		return nil, fmt.Errorf("medical_license es requerido para el rol doctor")
	}
	if len(in.KDFSalt) < 16 {
		return nil, fmt.Errorf("kdf_salt debe tener al menos 128 bits")
	}
	if len(in.PublicKey) != 32 || len(in.SigningPublicKey) != 32 {
		return nil, fmt.Errorf("claves públicas X25519/Ed25519 deben ser de 32 bytes")
	}
	if len(in.Password) < 12 {
		return nil, fmt.Errorf("la contraseña debe tener al menos 12 caracteres")
	}

	hash, err := crypto.HashPassword(in.Password)
	if err != nil {
		return nil, err
	}

	u := &domain.User{
		Email:            in.Email,
		MedicalLicense:   in.MedicalLicense,
		Role:             in.Role,
		AuthPasswordHash: hash,
		KDFSalt:          in.KDFSalt,
		PublicKey:        in.PublicKey,
		SigningPublicKey: in.SigningPublicKey,
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

type LoginInput struct {
	Email     string
	Password  string
	TOTPCode  string
	ClientIP  string
	UserAgent string
}

type LoginResult struct {
	AccessToken string
	ExpiresAt   time.Time
	User        *domain.User
}

func (s *AuthService) Login(ctx context.Context, in LoginInput) (*LoginResult, error) {
	ip := in.ClientIP
	if s.ipTruncate {
		ip = crypto.TruncateIP(ip)
	}

	u, err := s.users.GetByEmail(ctx, in.Email)
	if err != nil {
		// No revelamos si el email existe o no (mismo error para ambos casos).
		return nil, ErrInvalidCredentials
	}

	if u.LockedUntil != nil && time.Now().Before(*u.LockedUntil) {
		_ = s.audit.LogAccess(ctx, domain.AuditEntry{PatientID: u.ID, AccessorID: u.ID, Action: domain.AuditLoginLocked, ClientIP: ip, UserAgent: in.UserAgent})
		return nil, ErrAccountLocked
	}

	if err := crypto.VerifyPassword(u.AuthPasswordHash, in.Password); err != nil {
		_ = s.users.RegisterFailedLogin(ctx, u.ID)
		_ = s.audit.LogAccess(ctx, domain.AuditEntry{PatientID: u.ID, AccessorID: u.ID, Action: domain.AuditLoginFailed, ClientIP: ip, UserAgent: in.UserAgent})
		if u.FailedLoginCount+1 >= maxFailedLogins {
			// El próximo intento ya verá LockedUntil poblado por esta escritura.
			_ = s.lockAccount(ctx, u.ID)
		}
		return nil, ErrInvalidCredentials
	}

	if u.TOTPEnabled {
		if in.TOTPCode == "" {
			return nil, ErrTOTPRequired
		}
		ok, err := s.totp.ValidateCode(u.TOTPSecretEnc, in.TOTPCode)
		if err != nil || !ok {
			_ = s.users.RegisterFailedLogin(ctx, u.ID)
			_ = s.audit.LogAccess(ctx, domain.AuditEntry{PatientID: u.ID, AccessorID: u.ID, Action: domain.AuditLoginFailed, ClientIP: ip, UserAgent: in.UserAgent})
			return nil, ErrTOTPInvalid
		}
	}

	_ = s.users.ResetFailedLogin(ctx, u.ID)
	_ = s.audit.LogAccess(ctx, domain.AuditEntry{PatientID: u.ID, AccessorID: u.ID, Action: domain.AuditLoginSuccess, ClientIP: ip, UserAgent: in.UserAgent})

	token, expiresAt, err := s.jwt.Issue(u.ID, string(u.Role))
	if err != nil {
		return nil, err
	}
	return &LoginResult{AccessToken: token, ExpiresAt: expiresAt, User: u}, nil
}

func (s *AuthService) lockAccount(ctx context.Context, id uuid.UUID) error {
	until := time.Now().Add(accountLockDelay)
	// Reutilizamos ResetFailedLogin para limpiar contador y luego seteamos
	// el lock directamente vía repositorio (evita otra query redundante en
	// el flujo caliente de login).
	return s.users.SetLockedUntil(ctx, id, until)
}

// RequireDoctorMFA fuerza (política, adenda punto 4) que médicos y
// administradores de clínica tengan TOTP activo antes de poder crear o
// consumir delegaciones. Se llama desde el middleware de autorización de
// esos endpoints, no aquí, para mantener este servicio enfocado en
// autenticación pura.
func RequireDoctorMFA(u *domain.User) error {
	if (u.Role == domain.RoleDoctor || u.Role == domain.RoleClinicAdmin) && !u.TOTPEnabled {
		return errors.New("el rol médico/clínica requiere segundo factor (TOTP) habilitado")
	}
	return nil
}
