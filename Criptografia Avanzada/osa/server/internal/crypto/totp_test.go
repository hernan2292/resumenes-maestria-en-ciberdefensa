package crypto

import "testing"

func TestTOTPManager_GenerateAndValidate(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	m := NewTOTPManager(key)

	secret, encrypted, err := m.GenerateSecret("medico@example.com")
	if err != nil {
		t.Fatalf("GenerateSecret falló: %v", err)
	}
	if secret == "" {
		t.Fatal("el secreto TOTP no debería estar vacío")
	}

	// No podemos generar el código real sin importar otp/totp aquí de
	// nuevo con time.Now(), pero sí verificamos que un código basura no
	// valide y que el ciclo de cifrado/descifrado del secreto no falle.
	ok, err := m.ValidateCode(encrypted, "000000")
	if err != nil {
		t.Fatalf("ValidateCode no debería fallar con error para un código simplemente incorrecto: %v", err)
	}
	if ok {
		t.Fatal("un código arbitrario '000000' no debería validar salvo coincidencia astronómica")
	}
}

func TestTOTPManager_EncryptedSecretNotPlaintext(t *testing.T) {
	key := make([]byte, 32)
	m := NewTOTPManager(key)
	secret, encrypted, err := m.GenerateSecret("x@example.com")
	if err != nil {
		t.Fatalf("GenerateSecret falló: %v", err)
	}
	if string(encrypted) == secret {
		t.Fatal("el secreto persistido nunca debe ser igual al secreto en claro")
	}
}
