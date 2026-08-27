package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// TOTPManager cifra en reposo el secreto TOTP de cada usuario con una clave
// simétrica del servidor (variable de entorno / KMS), nunca lo persiste en
// claro. El segundo factor es obligatorio para 'doctor' y 'clinic_admin'
// por política (adenda punto 4): comprometer sólo la contraseña de un
// médico no alcanza para robar K_idx/K_enc de sus pacientes delegantes.
type TOTPManager struct {
	encKey []byte // 32 bytes, AES-256-GCM
}

func NewTOTPManager(encKey []byte) *TOTPManager {
	return &TOTPManager{encKey: encKey}
}

func (m *TOTPManager) GenerateSecret(accountEmail string) (secret string, encryptedForStorage []byte, err error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "OSA Historial Médico",
		AccountName: accountEmail,
	})
	if err != nil {
		return "", nil, err
	}
	enc, err := m.encrypt([]byte(key.Secret()))
	if err != nil {
		return "", nil, err
	}
	return key.Secret(), enc, nil
}

func (m *TOTPManager) ValidateCode(encryptedSecret []byte, code string) (bool, error) {
	secretBytes, err := m.decrypt(encryptedSecret)
	if err != nil {
		return false, err
	}
	return totp.Validate(code, string(secretBytes)), nil
}

func (m *TOTPManager) URI(encryptedSecret []byte, accountEmail string) (string, error) {
	secretBytes, err := m.decrypt(encryptedSecret)
	if err != nil {
		return "", err
	}
	key, err := otp.NewKeyFromURL(fmt.Sprintf(
		"otpauth://totp/%s:%s?secret=%s&issuer=%s",
		"OSA", accountEmail, string(secretBytes), "OSA",
	))
	if err != nil {
		return "", err
	}
	return key.String(), nil
}

func (m *TOTPManager) encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(m.encKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func (m *TOTPManager) decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(m.encKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("ciphertext demasiado corto")
	}
	nonce, ct := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ct, nil)
}
