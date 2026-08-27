# OSA — cliente (React + TypeScript + Vite)

Portal paciente/médico. Toda la criptografía (Argon2id, HKDF, X25519,
Ed25519, AES-256-GCM, SSE-2) corre en el navegador — ver `src/crypto/` y
`src/services/`. El servidor nunca ve claves, contenido en claro ni
palabras buscadas. Detalle completo en `../docs/ESPECIFICACION_TECNICA_SSE2.md`
y `../docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md`.

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:5173, requiere la API corriendo (ver ../server/README o ../README.md)
npm run build       # tsc -b && vite build -> dist/
npm run lint         # oxlint
```

`VITE_API_BASE_URL` (default `http://localhost:8080`) se lee en tiempo de
build de Vite — para apuntar a otra API, exportá la variable antes de
`npm run dev`/`npm run build`, o creá un `.env.local` con
`VITE_API_BASE_URL=...`.

## Test de integración end-to-end (criptografía real)

`integration-test/run.ts` ejercita el flujo completo (registro, login,
subida y búsqueda cifrada, delegación con MFA, procesamiento de pendientes,
revocación y rotación de clave maestra) contra un backend Go + Postgres
real, usando el mismo código de cliente que usa el navegador. Con la API
corriendo en `http://127.0.0.1:8080`:

```bash
npx tsx integration-test/run.ts
```
