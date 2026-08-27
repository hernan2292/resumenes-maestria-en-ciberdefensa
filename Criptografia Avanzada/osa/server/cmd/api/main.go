// Comando principal del servidor de custodia ciega. Arranca fail-closed:
// si falta configuración de seguridad o la base no responde, el proceso
// termina en vez de servir tráfico en un estado parcialmente inseguro.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/osa-project/server/internal/config"
	"github.com/osa-project/server/internal/crypto"
	"github.com/osa-project/server/internal/repository/postgres"
	"github.com/osa-project/server/internal/service"
	transporthttp "github.com/osa-project/server/internal/transport/http"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("configuración inválida: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("no se pudo conectar a la base de datos: %v", err)
	}
	defer pool.Close()

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = filepath.Join("migrations")
	}
	if err := postgres.RunMigrations(ctx, pool, migrationsDir); err != nil {
		log.Fatalf("error aplicando migraciones: %v", err)
	}

	users := postgres.NewUserRepository(pool)
	documents := postgres.NewDocumentRepository(pool)
	index := postgres.NewIndexRepository(pool)
	scopeLabels := postgres.NewScopeLabelRepository(pool)
	delegations := postgres.NewDelegationRepository(pool)
	audit := postgres.NewAuditRepository(pool)

	jwtIssuer := crypto.NewJWTIssuer(cfg.JWTSigningKey, cfg.JWTAccessTokenTTL)
	totpManager := crypto.NewTOTPManager(cfg.TOTPEncryptionKey)
	loginLimiter := crypto.NewLoginRateLimiter(cfg.RateLimitLoginPerMinute, time.Minute, 5*time.Minute)

	authService := service.NewAuthService(users, audit, jwtIssuer, totpManager, cfg.AuditIPTruncate)
	delegationService := service.NewDelegationService(delegations, users, audit)
	documentService := service.NewDocumentService(documents, users, delegations, scopeLabels, audit)
	searchService := service.NewSSESearchService(index, delegations, audit, cfg.AuditIPTruncate)
	rekeyService := service.NewRekeyService(users, index, delegations, documents, audit)

	srv := &transporthttp.Server{
		Auth:           authService,
		Delegation:     delegationService,
		Document:       documentService,
		Search:         searchService,
		Rekey:          rekeyService,
		Users:          users,
		Audit:          audit,
		TOTP:           totpManager,
		JWT:            jwtIssuer,
		LoginLimiter:   loginLimiter,
		AllowedOrigins: cfg.AllowedOrigins,
		IPTruncate:     cfg.AuditIPTruncate,
		TrustProxy:     os.Getenv("TRUST_PROXY") == "true",
	}

	httpServer := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("OSA API escuchando en %s (env=%s)", cfg.ListenAddr, cfg.Environment)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("error del servidor HTTP: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("apagando servidor...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("error durante el apagado: %v", err)
	}
}
