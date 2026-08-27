# OSA — servidor (Go)

Custodio ciego: recibe y guarda blobs cifrados, índices invertidos cifrados
y sobres de clave cifrados, pero nunca ve contenido en claro, claves de
cifrado ni palabras buscadas. Ver `../docs/ESPECIFICACION_TECNICA_SSE2.md`
y, sobre todo, `../docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md` (20 hallazgos y
correcciones respecto de la especificación original).

## Desarrollo local (sin Docker)

Requiere Go 1.22+ y Postgres 14+ accesibles localmente.

```bash
createdb osa_dev   # o el nombre que prefieras
cp .env.dev.example .env.dev   # completar secretos si no existe .env.dev
set -a; source .env.dev; set +a
go build ./... && go vet ./... && go test ./...
go run ./cmd/api
```

Las migraciones (`migrations/0001_init.sql`) se aplican automáticamente al
arrancar (`postgres.RunMigrations`).

## Vendoring de dependencias

`vendor/` ya incluye las 38 dependencias necesarias (`vendor/modules.txt`),
así que `go build`/`go test`/`go vet` funcionan sin acceso a
`proxy.golang.org` — Go detecta el modo vendor automáticamente a partir de
`go.mod` (`go 1.22`) + `vendor/modules.txt`. Si necesitás actualizar una
dependencia, `vendor_from_apt.sh` documenta cómo se generó el vendor
original a partir de paquetes `golang-*` de Debian; con acceso normal a
internet alcanza con `go get <paquete>@<versión> && go mod vendor`.

## Variables de entorno

Ver `internal/config/config.go` — el loader es fail-closed: si falta
`DATABASE_URL`, `JWT_SIGNING_KEY` (mín. 32 caracteres) o
`TOTP_ENCRYPTION_KEY` (exactamente 32 bytes), el proceso no arranca. Ver
`.env.dev` para un ejemplo de desarrollo, y `../.env.example` para el stack
completo con Docker.
