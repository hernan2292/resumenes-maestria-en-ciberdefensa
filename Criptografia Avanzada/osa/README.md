# OSA — Historia clínica de conocimiento cero (Zero-Knowledge EHR/PHR)

MVP funcional completo de una plataforma de historia clínica donde el
servidor es un **custodio ciego**: nunca ve contenido médico en claro,
claves de cifrado, ni las palabras que un paciente o médico busca. Toda la
criptografía (derivación de claves con Argon2id, cifrado AES-256-GCM,
delegación temporal firmada con Ed25519/X25519, búsqueda simétrica cifrada
SSE-2) corre en el navegador. Implementa
`docs/ESPECIFICACION_TECNICA_SSE2.md`, con 20 correcciones de seguridad y
de corrección documentadas en `docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md` —
léanla, ahí está el detalle de qué cambió respecto de la especificación
original y por qué (varias son bugs críticos que habrían roto el modelo
zero-knowledge o dejado datos indescifrables; se encontraron y corrigieron
durante la implementación, algunos gracias al test de integración de punta
a punta descrito más abajo).

## Arquitectura

- **`server/`** — API en Go (stdlib `net/http`, sin framework de terceros
  a propósito, para minimizar superficie de cadena de suministro), Postgres
  como único almacén. Ver `server/README.md`.
- **`client/`** — Portal paciente/médico en React + TypeScript + Vite.
  Toda la criptografía vive en `client/src/crypto/` y
  `client/src/services/`. Ver `client/README.md`.
- **`docs/`** — Especificación técnica original y la adenda de seguridad.

## Levantar todo con Docker (recomendado)

Requiere Docker con soporte de Compose (`docker compose version`).

```bash
cp .env.example .env
# Editá .env: como mínimo cambiá POSTGRES_PASSWORD, JWT_SIGNING_KEY y
# TOTP_ENCRYPTION_KEY (instrucciones de cómo generarlos están en el propio
# archivo). El stack NO arranca si dejás los placeholders sin generar algo
# de longitud correcta, salvo que uses los mismos valores de ejemplo — que
# sirven para desarrollo local pero jamás deberían usarse así en producción.

docker compose up --build
```

- Portal web: http://localhost:5173
- API: http://localhost:8080 (`GET /healthz` para chequear que está viva)
- Postgres queda en un volumen con nombre (`osa_postgres_data`), no expuesto
  al host por defecto.

> **Nota sobre este entorno de desarrollo:** los `Dockerfile` y
> `docker-compose.yml` fueron escritos y su sintaxis se validó con
> `docker compose config`, pero el sandbox donde se generó este proyecto
> tiene bloqueado el acceso a los registries de imágenes (Docker Hub, gcr.io,
> etc.), así que el build de las imágenes en sí **no pudo ejecutarse de
> punta a punta acá**. Cada pieza que sí se pudo verificar de forma aislada
> — `go build`/`go vet`/`go test` del backend, `npm run build` del
> frontend, y el test de integración corriendo ambos contra un Postgres
> real — pasó limpio (ver más abajo). Si al correr `docker compose up
> --build` en tu máquina encontrás algún ajuste necesario (versión de
> imagen base, etc.), debería ser menor; avisame y lo corrijo.

## Desarrollo local sin Docker

Necesitás Go 1.22+, Node 20+, y Postgres 14+ corriendo localmente.

```bash
# 1. Backend
createdb osa_dev
cd server
cp .env.dev.example .env.dev   # o editá .env.dev si ya existe
set -a; source .env.dev; set +a
go run ./cmd/api               # aplica migraciones solo y escucha en :8080

# 2. Frontend (en otra terminal)
cd client
npm install
npm run dev                    # http://localhost:5173
```

## Test de integración end-to-end (criptografía real, sin mocks)

Con la API corriendo (Docker o local) y accesible en
`http://127.0.0.1:8080`:

```bash
cd client
npx tsx integration-test/run.ts
```

Este script usa el mismo código TypeScript que el navegador (no una
reimplementación de la criptografía) para: registrar paciente y médico,
subir y buscar un documento cifrado, verificar que el segundo factor es
obligatorio para que un médico consuma una delegación, crear una delegación
con alcance restringido y consumirla, buscar y leer el documento como
médico delegado, subir un documento sin delegación activa y verificar que
queda "por indexar" hasta que el paciente lo procesa, revocar la
delegación, y rotar la clave maestra del paciente verificando que **todo**
el historial sigue siendo legible después (esto ejercita directamente la
corrección del punto 19 de la adenda). 26 verificaciones, todas en verde en
la última corrida.

## Seguridad y privacidad

Empezá por `docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md`. Resumen de las
garantías centrales:

- El servidor nunca recibe contraseñas más allá de un hash Argon2id de
  autenticación (independiente de las claves de cifrado, que se derivan
  aparte y sólo en el navegador).
- Título, tipo de documento y contenido viajan siempre cifrados; el
  servidor sólo ve tamaños en bloques fijos de 64KiB (padding
  anti-inferencia) y trapdoors HMAC opacos para búsqueda.
- El acceso de un médico es temporal (máx. 120 min, validado en servidor),
  revocable en un click, restringible por categoría clínica sin que el
  servidor conozca la categoría, y requiere segundo factor (TOTP)
  obligatorio antes de poder consumirse.
- Las claves de sesión viven sólo en RAM del navegador (nunca
  `localStorage`), con auto-bloqueo a los 10 minutos de inactividad.
- La rotación soberana de clave maestra (por sospecha de compromiso) revoca
  todas las delegaciones activas y re-cifra el historial completo para la
  identidad nueva, sin dejar ningún documento indescifrable.

Fuera de alcance de este MVP (ver el final de la adenda): acceso de
emergencia ("break-glass"), cifrado transparente de disco en Postgres,
verificación de matrícula médica contra un colegio real, exportación FHIR.
