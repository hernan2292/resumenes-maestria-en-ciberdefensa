# Adenda de Seguridad y Correcciones a ESPECIFICACION_TECNICA_SSE2.md

Este documento registra las brechas de privacidad/seguridad detectadas en la
especificación v2.0.0 durante la implementación, y la corrección aplicada en
el código. Se prioriza confidencialidad del paciente por sobre conveniencia
de implementación.

## 1. `doc_type` en texto plano filtraba metadatos clínicos (CRÍTICO)

**Problema:** la tabla `medical_documents` guardaba `doc_type` (`lab_result`,
`imaging`, ...) sin cifrar. Aunque el contenido está cifrado, el servidor (o
cualquiera con acceso a la base) podía inferir el tipo de condición del
paciente (p. ej. distinguir "imaging" oncológico de una receta común) —
justo lo que la Sección 7.4 (padding anti-inferencia) buscaba evitar.

**Corrección:** `doc_type` se cifra igual que `title` (`doc_type_encrypted`,
AES-256-GCM). El servidor nunca ve la categoría en claro.

## 2. `scope` de la delegación no se validaba en el servidor

**Problema:** `access_delegations.scope` ("cardiología", "todos", ...) se
guardaba pero `SearchAsDoctor` nunca lo usaba para filtrar resultados. Un
médico con delegación restringida a una especialidad podía en la práctica
buscar y ver *todo* el historial del paciente.

**Corrección:** se introduce un esquema de "etiquetas de alcance" análogo al
de SSE-2: al subir un documento, el cliente calcula
`scope_label = HMAC-SHA256(K_idx, "SCOPE#" || categoria)` y lo guarda en
`document_scope_labels`. Al crear una delegación con alcance restringido, el
paciente adjunta el mismo `scope_label` (no la categoría en claro). El
servidor, ciego a la categoría real, sólo intersecta la posting list con los
documentos que tengan ese `scope_label`, sin poder invertir el HMAC (no
conoce `K_idx`). Así el enforcement es real y sigue siendo zero-knowledge.

## 3. Sin límite de intentos / fuerza bruta en `/auth/login`

**Corrección:** rate limiting por IP+email (token bucket) en middleware,
más backoff exponencial registrado en auditoría (`LOGIN_FAILED`,
`LOGIN_LOCKED`).

## 4. Sin segundo factor para médicos

Un ticket de delegación depende de que la cuenta del médico no esté
comprometida (su `SK_med` descifra las claves del paciente). Se agrega TOTP
(RFC 6238) opcional-pero-recomendado para rol `doctor`/`clinic_admin`,
obligatorio se puede forzar por política.

## 5. Falta de cabeceras de seguridad HTTP

Se agrega middleware con `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Content-Security-Policy` restrictiva, `Referrer-Policy: no-referrer`.

## 6. CSRF

Se evita completamente: autenticación por `Authorization: Bearer <JWT>` en
vez de cookies de sesión. No hay estado de sesión en cookie que un sitio de
terceros pueda reutilizar.

## 7. Minimización de IP en auditoría (GDPR data minimization)

**Problema:** `client_ip` en texto plano y sin política de retención choca
con minimización de datos de GDPR para un log que además es "inmutable".

**Corrección:** se guarda el IP truncado (últimos 8 bits en IPv4 / se
conserva sólo el prefijo `/48`, es decir se ponen a cero los últimos 80
bits, en IPv6) salvo que la política del deployment exija IP completa por
razones legales locales (config `AUDIT_IP_TRUNCATE=true` por defecto). Se documenta una política de retención sugerida (p. ej. purgar o
archivar logs de auditoría después de N años según normativa local) como
tarea operativa, no de código.

## 8. Padding de tamaño y trapdoors señuelo (mencionados pero no
   especificados) — implementados

- `aesGcm.ts` aplica *length padding* (ISO/IEC 7816-4 style: `0x80` + ceros)
  hasta el múltiplo de 64 KiB superior antes de cifrar cualquier blob.
- El buscador del médico agrega automáticamente 2-4 trapdoors señuelo
  aleatorios a cada lote de búsqueda (`POST /api/v1/search/batch`); el
  servidor no distingue reales de señuelo (ambos son HMACs opacos), así que
  no requiere cambios de confianza en el servidor, sólo que el endpoint
  acepte lotes.

## 9. Zero-fill de claves en RAM y cierre por inactividad

`CryptoSessionContext.tsx` guarda las claves de sesión sólo en variables de
JS (nunca `localStorage`/`sessionStorage`/`IndexedDB`), sobrescribe los
`Uint8Array` con ceros al cerrar sesión o expirar el timer de 10 minutos de
inactividad (mousemove/keydown/visibilitychange), y limpia el bundle
descifrado del médico al expirar el TTL de la delegación activa (chequeo
cliente cada 15s, independiente de la validación server-side que sigue
siendo la autoridad real).

## 10. X25519 real en frontend y backend (la spec mezclaba P-256 y X25519)

**Problema:** la Sección 2 declara `X25519` como primitiva de intercambio
de claves, pero el ejemplo de código de `delegationCrypto.ts` (Sección 6.2)
usaba `ECDH` con `P-256` de WebCrypto (WebCrypto nativo no soporta X25519
de forma consistente entre navegadores).

**Corrección:** se usa `@noble/curves` (implementación auditada, constante
en tiempo, puro TS) para X25519 y Ed25519 tanto en el cifrado de sobres
(`Enc_PK_pac`, `Enc_PK_med`) como en las firmas de tickets/consentimientos,
consistente con el servidor Go (`golang.org/x/crypto/curve25519`,
`crypto/ed25519`). AES-GCM sigue usando WebCrypto nativo (sí soportado de
forma consistente y con mejor rendimiento que una implementación JS).

## 11. Auditoría cubre las tres acciones de la tabla, no sólo búsqueda

El código de ejemplo sólo registraba `SEARCH_QUERY`. Se agrega logging
para `UPLOAD` (médico o paciente sube documento) y `DOCUMENT_DOWNLOAD`
(cualquier descarga/descifrado de blob), cumpliendo lo que la Sección 5.1
promete ("registro firmado de cada intento de búsqueda médica") pero
extendido a todo acceso a datos clínicos, como exige HIPAA §164.312(b).

## 12. Tope de 120 min de delegación validado en servidor, no sólo en UI

`delegation_service.CreateDelegation` rechaza (`400`) cualquier
`valid_until - valid_from > 120min`, en vez de confiar en que el cliente
React respete el límite.

## 13. Hash de contraseña de servidor vs. clave de cifrado de cliente

Se refuerza explícitamente en el código que `auth_password_hash` (Argon2id
en servidor, para autenticar la sesión HTTP) y la KDF cliente que deriva
`K_enc/K_idx/SK_pac` a partir de la misma contraseña son **derivaciones
independientes con salts y `info` distintos** (dominio separado vía
HKDF `info="osa/authhash"` vs `info="osa/enckey"` etc.), para que un
volcado del hash de autenticación no ayude a atacar las claves de cifrado.

## 14. Inconsistencia en la resolución de la posting list (CRÍTICO)

**Problema:** el código Go de ejemplo (Sección 5.3) hace
`s.indexRepo.ResolvePostingList(ctx, entry.EncryptedPostingList)` para
obtener los `docIDs` en claro y luego `s.docRepo.GetDocumentsByIDs(...)` en
el mismo request. Pero `encrypted_posting_list` está cifrada con material
que sólo el paciente/médico delegado poseen (`K_idx`/`K_enc` nunca llegan al
servidor) — el servidor **no puede** descifrarla ni "resolverla" a IDs. Tal
como estaba escrito, el código no compila conceptualmente sin romper el
modelo zero-knowledge (o bien el servidor terminaría teniendo la clave, lo
cual anula todo el diseño).

**Corrección — flujo en dos pasos:**
1. `POST /api/v1/search/batch` (`SearchAsDoctor`/`SearchAsPatient`): el
   servidor valida delegación/TTL/firma, hace el lookup por `L_w` y
   devuelve `encrypted_posting_list` **tal cual, todavía cifrada**, al
   cliente. El servidor sigue sin saber cuántos ni cuáles documentos
   matchean en claro.
2. El cliente descifra la posting list localmente (con `K_idx`/`K_enc` en
   RAM) y obtiene los `docID` reales.
3. `GET /api/v1/documents/{id}` (`GetDocument`): el cliente pide los blobs
   uno por uno (o en lote) usando el mismo ticket de delegación. Acá es
   donde el servidor **sí** puede y debe aplicar el control de acceso:
   pertenencia a `patient_id`, TTL/revocación de la delegación, y — este es
   también el punto correcto para aplicar el enforcement de `scope` de la
   Sección 3.1 (ver punto 2 de esta adenda): si la delegación restringe a
   una especialidad, el documento debe tener el `scope_label`
   correspondiente en `document_scope_labels` o se responde `403`, sin que
   el servidor necesite saber la especialidad real en ningún momento.

Este rediseño es además más fiel al espíritu "zero-knowledge" que el pseudo
código original, y es el que implementa `sse_search_service.go` +
`document_service.go`.

## 15. Código público en vez de email para localizar pacientes/médicos

**Problema:** la Sección 4.1 dice que el médico "selecciona el paciente
mediante su identificador/código médico público", pero no lo define, y el
resto de la spec sólo tiene `email` como identificador. Un endpoint de
"buscar por email" habilita cosechado/enumeración de las direcciones de
correo de pacientes y médicos (un problema de privacidad en sí mismo para
una plataforma de salud).

**Corrección:** cada usuario recibe al registrarse un `public_code`
aleatorio no adivinable (ej. `OSA-7F3K-9QRT`, 60 bits de entropía), pensado
para compartirse verbalmente o por QR en el consultorio. Todo lookup
cruzado (médico busca paciente, paciente busca médico para delegar) se hace
por `public_code`, nunca por email. `GET /api/v1/users/by-code/{code}` sólo
devuelve `id`, `role` y las claves públicas — nunca el email.

## 16. Un médico delegado no tenía forma de LEER los documentos, sólo de
    encontrarlos — y tampoco podía indexar los que sube (CRÍTICO)

**Problema (dos caras del mismo bug):** siguiendo el pseudocódigo original
de la Sección 4.1 al pie de la letra, cada documento se cifraría con una
clave `K_doc` envuelta únicamente con `PK_pac` (ECIES). Pero un médico con
una delegación activa (Sección 3) sólo recibe `K_idx`/`K_enc` — **nunca**
`SK_pac`. Resultado: un médico delegado podía ejecutar búsquedas SSE-2 y
obtener IDs de documentos coincidentes, pero jamás podía descifrar el
`encrypted_key_envelope` de ninguno de ellos para leerlos — el caso de uso
central de la delegación ("el médico busca y visualiza el historial")
quedaba roto. Además, el problema simétrico ya señalado (adenda original):
un médico subiendo un documento sin `K_idx` no puede calcular trapdoors
reales para indexarlo.

**Corrección — doble sobre de clave, y `needs_indexing` en vez de una cola
cifrada de palabras:**
- Cada documento sigue teniendo una `K_doc` efímera (AES-256) que cifra
  `title`/`doc_type`/`blob`. Esa `K_doc` se envuelve de HASTA DOS formas,
  guardadas en columnas separadas (`migrations/0001_init.sql`):
  - `encrypted_key_envelope` = `ECIES_{PK_pac}(K_doc)` — **siempre**
    presente. Garantiza que el paciente pueda descifrar cualquier
    documento propio pase lo que pase.
  - `encrypted_key_envelope_symmetric` = `AES-GCM_{K_enc}(K_doc)` —
    presente cuando quien subió el documento tenía `K_enc` en ese momento
    (el paciente, siempre; un médico, sólo si en ese momento tenía una
    delegación activa para ese paciente). Es el camino que un médico
    delegado SÍ puede usar, porque `K_enc` es justo lo que la delegación le
    entrega.
- `needs_indexing BOOLEAN` reemplaza a la cola cifrada de palabras clave de
  una versión anterior de esta adenda: si quien sube el documento ya tenía
  `K_idx` (mismo criterio que arriba), indexa con trapdoors reales en el
  acto — para eso `POST /api/v1/index/upsert` ahora también acepta al rol
  `doctor`/`clinic_admin` si adjuntan un `delegation_id` válido y vigente
  (antes era sólo para `patient`). Si no tenía `K_idx`, el documento queda
  con `needs_indexing = TRUE` y sin `encrypted_key_envelope_symmetric`.
- El paciente ve en su portal "N documentos por indexar" y, al procesarlos,
  simplemente **descifra el documento como cualquier otro** (ya tiene
  `SK_pac` siempre disponible), tokeniza el contenido en claro que obtiene
  de ese mismo descifrado — sin necesitar un sobre cifrado de palabras
  clave aparte, ni volver a llamar a un tokenizador distinto del que ya
  usa para sus propias subidas — sube los trapdoors reales, y adjunta el
  `encrypted_key_envelope_symmetric` faltante en la misma llamada a
  `POST /api/v1/documents/{id}/confirm-indexed`. A partir de ahí cualquier
  médico delegado futuro lee ese documento por el camino rápido.

El servidor sigue sin ver nunca palabras clave, títulos ni contenido en
claro en ningún paso. El único trade-off explícito es que un documento
subido por un médico SIN delegación activa (p. ej. un laboratorio
enviando resultados de forma asíncrona, sin una consulta en curso) queda
invisible a la búsqueda y sólo el paciente puede leerlo hasta que lo
procese — un compromiso razonable para un MVP, y estrictamente mejor que
el modelo original, que ni siquiera era descifrable por el médico en el
caso "feliz" de una delegación activa.

## 17. Qué clave cifra `title_encrypted`/`doc_type_encrypted`: aclaración

La spec no especifica con qué clave se cifran el título y el tipo de
documento al subir un archivo. La implementación usa, de forma uniforme
para autosubida del paciente y subida por un tercero, la misma `K_doc`
efímera por documento que ya cifra el blob (ver punto 16 arriba): se genera
aleatoria, cifra título + tipo + contenido, y esa `K_doc` (no título ni
tipo directamente) es lo que viaja envuelto — por uno o los dos caminos
descritos arriba, según qué clave tenía disponible quien subió. Así el
flujo de descarga es el mismo sin importar quién subió el documento:
descifrar cualquiera de los dos sobres da `K_doc`, y con eso se descifra
todo lo demás.

## 18. `RequireDoctorMFA` existía pero no se llamaba desde ningún lado (CRÍTICO)

**Problema:** el punto 4 de esta misma adenda documentaba TOTP como
"obligatorio se puede forzar por política" para `doctor`/`clinic_admin`, y el
código tenía efectivamente una función `service.RequireDoctorMFA(u)` que
implementa exactamente esa regla — pero nada en el árbol de rutas HTTP la
invocaba. En la práctica, cualquier cuenta de médico sin TOTP habilitado
podía igual llamar a `GET /api/v1/delegations/active` y obtener el sobre
cifrado con `K_idx`/`K_enc` de un paciente en cuanto un paciente le
delegara acceso: la política de 2FA obligatorio era, hasta esta corrección,
puramente aspiracional/documental.

**Corrección:** nuevo middleware `RequireDoctorMFA(users)` en
`transport/http/middleware.go` que consulta el estado *actual* de
`TOTPEnabled` en base de datos (no se puede leer del JWT: ese estado puede
cambiar entre login y el momento de la request, y el JWT no debería tener
que reemitirse sólo por eso) y responde `428 Precondition Required` si el
rol es médico/clínica y no tiene TOTP activo. Se aplica al único endpoint
por el que el cliente de un médico llega a obtener material de clave de
delegación, `GET /api/v1/delegations/active`
(`server.authedRoleWithDoctorMFA`, `router.go`): sin pasar por ahí, el
frontend del médico nunca tiene `K_idx`/`K_enc` de ningún paciente, así que
gatear ese único punto de entrada es, en la práctica, suficiente para
bloquear toda la superficie de búsqueda/lectura delegada sin tener que
repetir el chequeo en cada endpoint que consume esas claves. El frontend
(`doctor/DoctorDashboard.tsx`) detecta el `428` y guía al médico a
`/doctor/seguridad` para activar TOTP antes de reintentar.

## 19. La rotación de clave maestra (Flujo B) dejaba indescifrable TODO el historial previo (CRÍTICO — pérdida de datos)

**Problema:** `RekeyService.Rekey` (Sección 4.2, "rotación soberana de clave
maestra") reemplazaba la identidad X25519/Ed25519 del paciente
(`users.RekeyIdentity`) y todo el índice SSE-2, pero nunca tocaba
`medical_documents.encrypted_key_envelope`. Ese campo es, para cada
documento, `ECIES_{PK_pac}(K_doc)` — cifrado específicamente para la clave
pública X25519 *vieja*. En cuanto la identidad rotaba, la única `SK_pac` que
puede abrir ese sobre dejaba de existir en ningún lado (ni siquiera el
propio paciente la conserva a propósito, es lo que se está rotando) y **cada
documento subido antes de la rotación quedaba criptográficamente
irrecuperable para siempre** — no es un bug de disponibilidad temporal, es
pérdida de datos permanente disfrazada de "función de seguridad". Esto
volvía inutilizable en la práctica la funcionalidad que la Sección 4.2
describe como respuesta legítima a "sospecha de compromiso de dispositivo":
usarla borraba el historial clínico del paciente.

**Corrección:** `RekeyInput` ahora exige `NewDocumentKeyEnvelopes` — un
`encrypted_key_envelope` re-envuelto client-side (descifrado con la
`SK_pac` vieja, re-cifrado con ECIES para la `PK_pac` nueva) por **cada**
documento que el paciente tiene en ese momento. `RekeyService.Rekey`, dentro
de la misma transacción atómica que ya usaba para el índice y las
delegaciones, primero lista los IDs de documentos existentes
(`ListDocumentIDsForPatientTx`) y rechaza la operación completa (`400`, sin
tocar nada) si el conjunto recibido no cubre exactamente esos IDs — ni de
más ni de menos, ni duplicados — antes de aplicar
`RewrapKeyEnvelopesForPatient`. Como `K_enc` también rota en el mismo flujo,
el sobre simétrico viejo de cada documento (`encrypted_key_envelope_symmetric`,
adenda punto 16) ya no es abrible con el `K_enc` nuevo tampoco: en vez de
dejarlo como un AEAD que fallaría en silencio la próxima vez que un médico
delegado intente leerlo, se limpia (`NULL`) y el documento vuelve a
`needs_indexing = TRUE`, reutilizando el mismo flujo de backfill que ya
existía para documentos subidos sin `K_idx` (el paciente los "reprocesa" una
vez, igual que a cualquier documento pendiente, y recupera también la
indexación bajo el `K_idx` nuevo).

El costo para el cliente es real pero acotado: antes de poder rotar, el
portal del paciente debe descargar y descifrar (con las claves viejas, que
sigue teniendo en RAM durante el propio flujo de rotación) el
`encrypted_key_envelope` de cada uno de sus documentos, y volver a
envolverlo — trabajo proporcional al tamaño del historial, no a su
contenido (no hace falta re-descargar ni re-cifrar los blobs en sí, sólo la
`K_doc` de 32 bytes de cada uno). `SecurityPanel.tsx` implementa este flujo
completo antes de llamar a `POST /api/v1/patient/rekey-batch`.

## 20. El padding de 64KiB nunca coincidía con lo que el servidor exigía (CRÍTICO — todo upload fallaba)

**Problema:** `padToBlock` (Sección 7.4 / adenda punto 8) rellena el
*plaintext* hasta el próximo múltiplo de 64KiB, y `encryptDocumentBlob`
cifra ese plaintext ya paddeado. Pero AES-GCM antepone un IV de 12 bytes y
agrega un tag de autenticación de 16 bytes al resultado — 28 bytes de
overhead fijo que el cálculo del padding no tenía en cuenta. El servidor
(`document_service.go`) valida `len(encrypted_blob) % 65536 == 0` sobre el
blob *final* (IV+ciphertext+tag), que por construcción nunca podía ser
múltiplo de 65536 salvo coincidencia aritmética: **todo upload de documento
fallaba con `400`**. Este bug estaba presente desde que se escribió
`aesGcm.ts` y pasó inadvertido en la verificación manual (typecheck/build)
porque nunca se había ejecutado un upload real de punta a punta contra el
servidor — lo detectó `integration-test/run.ts` en su primera corrida.

**Corrección:** `padToBlock` ahora acepta un `targetResidue` opcional: en
vez de rellenar hasta el próximo múltiplo de `blockSize` (residuo 0),
`encryptDocumentBlob` le pide el residuo `(BLOCK_SIZE - 28) % BLOCK_SIZE`,
de modo que sea el paquete *final* (con IV y tag ya incluidos) el que caiga
exacto en el múltiplo de 64KiB que el servidor exige — no el plaintext
paddeado por sí solo. El overhead de 28 bytes es constante y público (no
depende del contenido ni revela nada que el propio esquema de bloques de
64KiB no revele ya), así que corregir el cálculo no reintroduce ninguna
fuga de tamaño.

## Fuera de alcance de este MVP (recomendado para siguiente iteración)

- Break-glass / acceso de emergencia con doble autorización.
- Cifrado transparente a nivel de disco de Postgres (TDE) — depende del
  proveedor de hosting.
- Rotación automática de `medical_license` / verificación contra colegio
  médico real.
- Exportación/portabilidad de datos formato FHIR.
