// Package postgres implementa la persistencia sobre PostgreSQL vía pgx.
// Ningún método de este paquete descifra nada: todos los []byte que entran
// y salen son blobs opacos generados/consumidos por el cliente.
package postgres

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/jackc/pgx/v4/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parseando DATABASE_URL: %w", err)
	}
	cfg.MaxConns = 20
	pool, err := pgxpool.ConnectConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("conectando a postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping a postgres falló: %w", err)
	}
	return pool, nil
}

// RunMigrations aplica, en orden, todos los .sql de migrationsDir que aún
// no figuren en la tabla schema_migrations. Es intencionalmente simple (sin
// dependencia externa como golang-migrate) para minimizar la superficie de
// cadena de suministro de un backend que custodia datos de salud.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool, migrationsDir string) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename    TEXT PRIMARY KEY,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("creando schema_migrations: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("leyendo directorio de migraciones: %w", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".sql" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, f := range files {
		var count int
		if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE filename = $1`, f).Scan(&count); err != nil {
			return fmt.Errorf("verificando migración %s: %w", f, err)
		}
		if count > 0 {
			continue
		}
		content, err := os.ReadFile(filepath.Join(migrationsDir, f))
		if err != nil {
			return fmt.Errorf("leyendo migración %s: %w", f, err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("iniciando tx para %s: %w", f, err)
		}
		if _, err := tx.Exec(ctx, string(content)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("aplicando migración %s: %w", f, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (filename) VALUES ($1)`, f); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("registrando migración %s: %w", f, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit de migración %s: %w", f, err)
		}
	}
	return nil
}
