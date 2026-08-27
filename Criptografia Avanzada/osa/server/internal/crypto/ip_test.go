package crypto

import "testing"

func TestTruncateIP_IPv4(t *testing.T) {
	got := TruncateIP("203.0.113.42")
	if got != "203.0.113.0" {
		t.Fatalf("got %s, want 203.0.113.0", got)
	}
}

func TestTruncateIP_IPv6(t *testing.T) {
	// Se conserva sólo el prefijo /48 (primeros 6 bytes); el resto se pone
	// a cero (ver internal/crypto/ip.go y adenda punto 7).
	got := TruncateIP("2001:db8:1234:5678:9abc:def0:1234:5678")
	if got != "2001:db8:1234::" {
		t.Fatalf("got %s, want 2001:db8:1234::", got)
	}
}

func TestTruncateIP_InvalidInputDoesNotPanic(t *testing.T) {
	got := TruncateIP("no-es-una-ip")
	if got != "0.0.0.0" {
		t.Fatalf("got %s, want fallback 0.0.0.0", got)
	}
}
