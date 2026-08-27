#!/bin/bash
# Genera vendor/ a partir de los paquetes Go instalados vía apt en este
# entorno de build, para que `go build -mod=vendor` funcione sin acceso a
# proxy.golang.org (útil en redes restringidas / on-prem, coherente con la
# prioridad de confidencialidad: menos llamadas salientes en build time).
#
# Si en tu máquina SÍ tenés acceso normal a internet, podés borrar vendor/
# y go.sum, y correr:
#   go mod tidy && go mod vendor
# para regenerar todo contra las versiones más recientes reales.
set -euo pipefail

SRC=/usr/share/gocode/src
DST="$(cd "$(dirname "$0")" && pwd)/vendor"
rm -rf "$DST"
mkdir -p "$DST"

copy_pkg() {
  local importpath="$1"
  local from="$SRC/$importpath"
  local to="$DST/$importpath"
  mkdir -p "$to"
  # todo excepto tests: .go, .s (asm), .h, archivos de licencia, etc.
  # (go mod vendor real también preserva .s — algunos paquetes como
  # golang.org/x/sys/cpu declaran funciones sin cuerpo implementadas en
  # ensamblador).
  find "$from" -maxdepth 1 -type f ! -name '*_test.go' -exec cp {} "$to/" \;
}

PKGS=(
  github.com/boombuler/barcode
  github.com/boombuler/barcode/qr
  github.com/boombuler/barcode/utils
  github.com/golang-jwt/jwt/v5
  github.com/google/uuid
  github.com/jackc/chunkreader/v2
  github.com/jackc/pgconn
  github.com/jackc/pgconn/internal/ctxwatch
  github.com/jackc/pgconn/stmtcache
  github.com/jackc/pgio
  github.com/jackc/pgpassfile
  github.com/jackc/pgproto3/v2
  github.com/jackc/pgservicefile
  github.com/jackc/pgtype
  github.com/jackc/pgx/v4
  github.com/jackc/pgx/v4/internal/sanitize
  github.com/jackc/pgx/v4/pgxpool
  github.com/jackc/puddle
  github.com/pquerna/otp
  github.com/pquerna/otp/hotp
  github.com/pquerna/otp/totp
  golang.org/x/crypto/argon2
  golang.org/x/crypto/blake2b
  golang.org/x/crypto/pbkdf2
  golang.org/x/sys/cpu
  golang.org/x/text/cases
  golang.org/x/text/internal
  golang.org/x/text/internal/language
  golang.org/x/text/internal/language/compact
  golang.org/x/text/internal/tag
  golang.org/x/text/language
  golang.org/x/text/runes
  golang.org/x/text/secure/bidirule
  golang.org/x/text/secure/precis
  golang.org/x/text/transform
  golang.org/x/text/unicode/bidi
  golang.org/x/text/unicode/norm
  golang.org/x/text/width
)

for p in "${PKGS[@]}"; do
  copy_pkg "$p"
done

echo "vendor/ generado con ${#PKGS[@]} paquetes."
