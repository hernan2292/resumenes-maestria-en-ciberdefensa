package crypto

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims del access token. Se usa Bearer token (Authorization header) en
// lugar de cookies de sesión: elimina CSRF por diseño (adenda punto 6), a
// costa de requerir que el cliente guarde el token sólo en memoria (nunca
// localStorage) — ver CryptoSessionContext.tsx en el frontend.
type Claims struct {
	UserID uuid.UUID `json:"uid"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

type JWTIssuer struct {
	signingKey []byte
	ttl        time.Duration
}

func NewJWTIssuer(signingKey []byte, ttl time.Duration) *JWTIssuer {
	return &JWTIssuer{signingKey: signingKey, ttl: ttl}
}

func (j *JWTIssuer) Issue(userID uuid.UUID, role string) (string, time.Time, error) {
	expiresAt := time.Now().Add(j.ttl)
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.NewString(),
			Issuer:    "osa-api",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(j.signingKey)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

func (j *JWTIssuer) Verify(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("método de firma inesperado")
		}
		return j.signingKey, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}
