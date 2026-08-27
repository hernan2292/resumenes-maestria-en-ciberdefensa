package postgres

import (
	"crypto/rand"
	"fmt"
)

// GeneratePublicCode crea un identificador público no adivinable (~60 bits
// de entropía) con el formato OSA-XXXX-XXXX usando el alfabeto Crockford
// Base32 (sin caracteres ambiguos como 0/O, 1/I/L), pensado para
// compartirse de palabra o por QR en el consultorio (adenda punto 15).
func GeneratePublicCode() (string, error) {
	const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ" // sin I, L, O, U
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generando public_code: %w", err)
	}
	out := make([]byte, 8)
	for i, b := range buf {
		out[i] = alphabet[int(b)%len(alphabet)]
	}
	return fmt.Sprintf("OSA-%s-%s", out[:4], out[4:]), nil
}
