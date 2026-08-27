package crypto

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestJWTIssuer_IssueAndVerify(t *testing.T) {
	issuer := NewJWTIssuer([]byte("clave-de-prueba-suficientemente-larga-32b"), 5*time.Minute)
	userID := uuid.New()

	token, expiresAt, err := issuer.Issue(userID, "patient")
	if err != nil {
		t.Fatalf("Issue falló: %v", err)
	}
	if time.Until(expiresAt) > 6*time.Minute {
		t.Fatalf("expiresAt fuera de rango esperado: %v", expiresAt)
	}

	claims, err := issuer.Verify(token)
	if err != nil {
		t.Fatalf("Verify falló con un token recién emitido: %v", err)
	}
	if claims.UserID != userID {
		t.Fatalf("UserID no coincide: got %v want %v", claims.UserID, userID)
	}
	if claims.Role != "patient" {
		t.Fatalf("Role no coincide: got %v", claims.Role)
	}
}

func TestJWTIssuer_RejectsTamperedToken(t *testing.T) {
	issuer := NewJWTIssuer([]byte("clave-de-prueba-suficientemente-larga-32b"), 5*time.Minute)
	token, _, _ := issuer.Issue(uuid.New(), "doctor")

	tampered := token[:len(token)-4] + "abcd"
	if _, err := issuer.Verify(tampered); err == nil {
		t.Fatal("Verify debería rechazar un token con firma alterada")
	}
}

func TestJWTIssuer_RejectsTokenSignedWithDifferentKey(t *testing.T) {
	issuerA := NewJWTIssuer([]byte("clave-A-suficientemente-larga-para-hmac-256"), 5*time.Minute)
	issuerB := NewJWTIssuer([]byte("clave-B-suficientemente-larga-para-hmac-256"), 5*time.Minute)

	token, _, _ := issuerA.Issue(uuid.New(), "patient")
	if _, err := issuerB.Verify(token); err == nil {
		t.Fatal("un token firmado con otra clave nunca debería validar")
	}
}

func TestJWTIssuer_RejectsExpiredToken(t *testing.T) {
	issuer := NewJWTIssuer([]byte("clave-de-prueba-suficientemente-larga-32b"), -1*time.Second)
	token, _, _ := issuer.Issue(uuid.New(), "patient")
	if _, err := issuer.Verify(token); err == nil {
		t.Fatal("un token ya expirado no debería validar")
	}
}
