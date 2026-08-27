// Package crypto agrupa las operaciones criptográficas que corren en el
// SERVIDOR (autenticación de sesión, JWT, TOTP, cifrado at-rest de secretos
// operativos). Toda la criptografía de datos clínicos ocurre en el cliente
// (ver client/src/crypto) — el servidor jamás ve una clave de contenido ni
// una contraseña de usuario en texto plano más allá del hashing.
package crypto

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Parámetros Argon2id para el hash de autenticación del SERVIDOR. Son
// independientes de los parámetros que usa el cliente para derivar claves
// de cifrado (ver adenda punto 13: separación de dominios).
const (
	argonTime    = 3
	argonMemory  = 64 * 1024 // 64 MiB
	argonThreads = 4
	argonKeyLen  = 32
	saltLen      = 16
)

// HashPassword deriva un hash Argon2id con salt aleatorio y lo codifica en
// el formato estándar $argon2id$v=19$m=...,t=...,p=...$salt$hash.
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generando salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	encoded := fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	)
	return encoded, nil
}

// VerifyPassword compara en tiempo constante. Retorna nil si coincide.
func VerifyPassword(encoded, password string) error {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return errors.New("formato de hash desconocido")
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return fmt.Errorf("versión inválida: %w", err)
	}
	var memory uint32
	var time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return fmt.Errorf("parámetros inválidos: %w", err)
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return fmt.Errorf("salt inválido: %w", err)
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return fmt.Errorf("hash inválido: %w", err)
	}

	computed := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(expected)))
	if subtle.ConstantTimeCompare(computed, expected) != 1 {
		return errors.New("contraseña incorrecta")
	}
	return nil
}
