package crypto

import (
	"sync"
	"time"
)

// LoginRateLimiter es un limitador simple en memoria por clave (IP+email).
// Para un despliegue multi-instancia se recomienda moverlo a Redis, pero en
// memoria ya frena fuerza bruta de un único atacante contra una instancia,
// y el objetivo aquí es defensa en profundidad, no ser la única barrera
// (adenda punto 3).
type LoginRateLimiter struct {
	mu           sync.Mutex
	attempts     map[string][]time.Time
	maxPerWindow int
	window       time.Duration
	lockDuration time.Duration
	lockedUntil  map[string]time.Time
}

func NewLoginRateLimiter(maxPerWindow int, window, lockDuration time.Duration) *LoginRateLimiter {
	return &LoginRateLimiter{
		attempts:     make(map[string][]time.Time),
		maxPerWindow: maxPerWindow,
		window:       window,
		lockDuration: lockDuration,
		lockedUntil:  make(map[string]time.Time),
	}
}

// Allow registra un intento y retorna false si la clave debe ser bloqueada.
func (l *LoginRateLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	if until, ok := l.lockedUntil[key]; ok {
		if now.Before(until) {
			return false
		}
		delete(l.lockedUntil, key)
		delete(l.attempts, key)
	}

	window := l.attempts[key]
	cutoff := now.Add(-l.window)
	kept := window[:0]
	for _, t := range window {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	kept = append(kept, now)
	l.attempts[key] = kept

	if len(kept) > l.maxPerWindow {
		l.lockedUntil[key] = now.Add(l.lockDuration)
		return false
	}
	return true
}

// Reset limpia el contador tras un login exitoso.
func (l *LoginRateLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
	delete(l.lockedUntil, key)
}
