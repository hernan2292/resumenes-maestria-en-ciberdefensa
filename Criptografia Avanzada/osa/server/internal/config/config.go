// Package config centraliza la carga de configuración desde variables de
// entorno. No hay valores secretos con default hardcodeado: si falta un
// secreto obligatorio, el servidor se niega a arrancar (fail-closed).
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	// DatabaseURL: cadena de conexión Postgres (postgres://user:pass@host:5432/db?sslmode=require)
	DatabaseURL string

	// ListenAddr: dirección donde escucha el servidor HTTP (detrás de un
	// reverse proxy TLS en producción; ver docker-compose.yml).
	ListenAddr string

	// JWTSigningKey: clave HMAC para firmar los access tokens del servidor.
	// Debe rotarse periódicamente; el token incluye "kid" para soportar
	// rotación sin invalidar sesiones activas si se agregan más claves.
	JWTSigningKey []byte

	// JWTAccessTokenTTL: vida del access token (corta, sesiones se refrescan).
	JWTAccessTokenTTL time.Duration

	// TOTPEncryptionKey: clave AES-256-GCM (32 bytes) con la que se cifra el
	// secreto TOTP de cada usuario antes de guardarlo en la base. Nunca se
	// guarda el secreto TOTP en claro en la base de datos.
	TOTPEncryptionKey []byte

	// AuditIPTruncate: si true (default), el log de auditoría trunca la IP
	// del cliente (últimos 8 bits IPv4 / 16 bits IPv6) para minimización de
	// datos GDPR. Desactivarlo sólo si una obligación legal local exige IP
	// completa (ver adenda punto 7).
	AuditIPTruncate bool

	// RateLimitLoginPerMinute: intentos de login permitidos por IP+email
	// antes de aplicar backoff (adenda punto 3).
	RateLimitLoginPerMinute int

	// Environment: "development" | "production". En production se exige
	// TLS terminado externamente y CORS estricto.
	Environment string

	// AllowedOrigins: orígenes permitidos para CORS (portal paciente/médico).
	AllowedOrigins []string
}

func requireEnv(key string) (string, error) {
	v := os.Getenv(key)
	if v == "" {
		return "", fmt.Errorf("variable de entorno requerida ausente: %s", key)
	}
	return v, nil
}

func Load() (*Config, error) {
	dbURL, err := requireEnv("DATABASE_URL")
	if err != nil {
		return nil, err
	}
	jwtKeyRaw, err := requireEnv("JWT_SIGNING_KEY")
	if err != nil {
		return nil, err
	}
	if len(jwtKeyRaw) < 32 {
		return nil, fmt.Errorf("JWT_SIGNING_KEY debe tener al menos 32 caracteres")
	}
	totpKeyRaw, err := requireEnv("TOTP_ENCRYPTION_KEY")
	if err != nil {
		return nil, err
	}
	if len(totpKeyRaw) != 32 {
		return nil, fmt.Errorf("TOTP_ENCRYPTION_KEY debe tener exactamente 32 bytes")
	}

	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = "127.0.0.1:8080"
	}

	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		env = "development"
	}

	truncate := true
	if v := os.Getenv("AUDIT_IP_TRUNCATE"); v != "" {
		parsed, err := strconv.ParseBool(v)
		if err != nil {
			return nil, fmt.Errorf("AUDIT_IP_TRUNCATE inválido: %w", err)
		}
		truncate = parsed
	}

	rateLimit := 10
	if v := os.Getenv("RATE_LIMIT_LOGIN_PER_MINUTE"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("RATE_LIMIT_LOGIN_PER_MINUTE inválido: %w", err)
		}
		rateLimit = parsed
	}

	accessTTL := 15 * time.Minute
	if v := os.Getenv("JWT_ACCESS_TOKEN_TTL_MINUTES"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("JWT_ACCESS_TOKEN_TTL_MINUTES inválido: %w", err)
		}
		accessTTL = time.Duration(parsed) * time.Minute
	}

	origins := []string{"http://localhost:5173"}
	if v := os.Getenv("ALLOWED_ORIGINS"); v != "" {
		origins = splitAndTrim(v)
	}

	if env == "production" && (len(origins) == 0) {
		return nil, fmt.Errorf("ALLOWED_ORIGINS es requerido en production")
	}

	return &Config{
		DatabaseURL:             dbURL,
		ListenAddr:              listenAddr,
		JWTSigningKey:           []byte(jwtKeyRaw),
		JWTAccessTokenTTL:       accessTTL,
		TOTPEncryptionKey:       []byte(totpKeyRaw),
		AuditIPTruncate:         truncate,
		RateLimitLoginPerMinute: rateLimit,
		Environment:             env,
		AllowedOrigins:          origins,
	}, nil
}

func splitAndTrim(s string) []string {
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := trimSpace(s[start:i])
			if part != "" {
				out = append(out, part)
			}
			start = i + 1
		}
	}
	return out
}

func trimSpace(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
