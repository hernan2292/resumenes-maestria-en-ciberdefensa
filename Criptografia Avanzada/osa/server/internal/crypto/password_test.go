package crypto

import "testing"

func TestHashAndVerifyPassword_RoundTrip(t *testing.T) {
	hash, err := HashPassword("una-contraseña-segura-123")
	if err != nil {
		t.Fatalf("HashPassword falló: %v", err)
	}
	if err := VerifyPassword(hash, "una-contraseña-segura-123"); err != nil {
		t.Fatalf("VerifyPassword debería aceptar la contraseña correcta: %v", err)
	}
}

func TestVerifyPassword_RejectsWrongPassword(t *testing.T) {
	hash, err := HashPassword("correcta-123456")
	if err != nil {
		t.Fatalf("HashPassword falló: %v", err)
	}
	if err := VerifyPassword(hash, "incorrecta-123456"); err == nil {
		t.Fatal("VerifyPassword debería rechazar una contraseña incorrecta")
	}
}

func TestHashPassword_DifferentSaltsProduceDifferentHashes(t *testing.T) {
	h1, _ := HashPassword("misma-contraseña")
	h2, _ := HashPassword("misma-contraseña")
	if h1 == h2 {
		t.Fatal("dos hashes de la misma contraseña con salts distintos no deberían ser iguales")
	}
}

func TestVerifyPassword_RejectsMalformedHash(t *testing.T) {
	if err := VerifyPassword("no-es-un-hash-argon2id", "cualquier-cosa"); err == nil {
		t.Fatal("VerifyPassword debería rechazar un hash con formato inválido")
	}
}
