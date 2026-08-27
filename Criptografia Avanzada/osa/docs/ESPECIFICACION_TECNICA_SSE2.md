# ESPECIFICACIÓN TÉCNICA Y ARQUITECTURA DEL SISTEMA
# Plataforma de Historial Médico y Documentos Clínicos Cifrados con SSE-2 y Delegación Temporal Zero-Knowledge

**Documento:** Especificación Técnica de Ingeniería y Criptografía  
**Versión:** 2.0.0 (Ajuste a Dominio Médico, Delegación Temporal y Multi-Rol)  
**Fecha:** 2026-08-25  
**Estado:** Aprobado para Implementación  
**Stack Principal:** Go 1.22+ (Backend / Custodia Ciega / Motor SSE) + React 18+ / TypeScript / WebCrypto API (Frontend / Zero-Knowledge Core)  

---

## 1. Resumen del Sistema y Objetivos de Negocio

### 1.1. Propósito
Desarrollar una plataforma web de **Historial Médico Electrónico (EHR / PHR)** de máxima seguridad basada en el principio **Zero-Knowledge**, donde:
1. **Propiedad Absoluta del Paciente:** El paciente es el único dueño de sus claves maestras y datos clínicos.
2. **Carga Segura por Médicos/Clínicas:** Los profesionales de la salud autorizados pueden cargar documentos, análisis de laboratorio y notas clínicas cifrándolos directamente para el paciente.
3. **Búsqueda Cifrada con SSE-2:** Permite realizar búsquedas exactas sobre términos médicos (diagnósticos, medicamentos, patologías, resultados de laboratorio) sobre datos cifrados sin descifrar la base de datos en el servidor.
4. **Delegación de Acceso Temporal y Restrictivo:** El paciente puede autorizar temporalmente a médicos o clínicas para buscar y visualizar su historial durante una ventana de tiempo estricta (ej. 30 minutos, 24 horas) o revocarla al instante.
5. **Rotación Soberana de Claves:** El paciente puede rotar o cambiar su clave maestra cuando lo desee, invalidando automáticamente cualquier acceso previo.
6. **Política de Seguridad Restrictiva:** Máximo aislamiento, registros de auditoría criptográficos inmutables, y cumplimiento formal de normativas de salud (**HIPAA / GDPR Health Data**).

---

## 2. Modelo Criptográfico y Gestión de Claves (Híbrido Asimétrico + SSE-2)

Para permitir que médicos suban documentos a pacientes y que el paciente delegue búsquedas temporalmente, se implementa una arquitectura criptográfica híbrida:

```
+----------------------------------------------------------------------------------------------------+
|                                    JERARQUÍA DE CLAVES POR USUARIO                                  |
+----------------------------------------------------------------------------------------------------+

[ PACIENTE ]
  Password Maestra + Salt
         |
         v (Argon2id KDF / PBKDF2)
  [ Clave Semilla Maestra ]
         |
         +---> [ Par Asimétrico Identidad: (PK_pac, SK_pac) ] (X25519 / Ed25519)
         |     - PK_pac: Pública (Permite a médicos cifrar documentos dirigidos al paciente)
         |     - SK_pac: Privada (Solo en RAM del paciente)
         |
         +---> [ Clave Simétrica Documentos: K_enc ] (AES-256-GCM)
         |     (Cifra el contenido de los análisis e historias clínicas)
         |
         +---> [ Clave de Índice SSE-2: K_idx ] (HMAC-SHA256)
         |     (Genera las trampas de búsqueda L_w = HMAC(K_idx, w || 1))
         |
         +---> [ Clave de Enmascaramiento: K_mask ] (HMAC-SHA256)

[ MÉDICO / CLÍNICA ]
  Credenciales + Clave Privada Profesional
         |
         v
  [ Par Asimétrico Médico: (PK_med, SK_med) ] (X25519 / Ed25519)
```

### 2.1. Primitivas Criptográficas Estandarizadas
- **Cifrado de Documentos y Archivos (Payloads):** `AES-256-GCM` con vectores de inicialización (IV) aleatorios de 96 bits únicos por documento.
- **Intercambio de Claves Asimétrico / KEM:** `X25519` (ECDH) con derivación de clave efímera mediante `HKDF-SHA256`.
- **Firmas Digitales y No Repudio:** `Ed25519` para firmas de autorizaciones temporales y consentimientos informados.
- **Índice Buscable SSE-2 (CGKO):** `HMAC-SHA256` para la función pseudoaleatoria (PRF) de generación de trampas (*trapdoors*).
- **Derivación de Clave Maestra (KDF):** `Argon2id` (v=19, m=64MB, t=3, p=4) o `PBKDF2-HMAC-SHA256` (600,000 iteraciones) con salt criptográfico de 256 bits generado en el registro.

---

## 3. Protocolo de Autorización y Delegación Temporal de Búsqueda

### 3.1. Concepto: Ticket Criptográfico de Delegación Temporal (TCDT)
Cuando el paciente autoriza a un médico (Dr. Pérez) para consultar su historial durante una consulta de 45 minutos:

1. **Generación del Ticket en el Navegador del Paciente:**
   - El paciente define: `DoctorID`, `ExpirationTimestamp (TTL)`, `Scope` (ej: "todos" o categoría "cardiología").
   - El cliente del paciente genera una clave de sesión efímera $K_{\text{session}}$ y empaqueta las claves de búsqueda ($K_{\text{idx}}$) y descifrado ($K_{\text{enc}}$) cifrándolas con la clave pública del médico ($PK_{\text{med}}$).
   - El paciente firma el ticket completo con su clave privada de firma ($SK_{\text{sig\_pac}}$).

$$\text{Ticket} = \left\langle \text{PatientID}, \text{DoctorID}, T_{\text{start}}, T_{\text{exp}}, \text{Scope}, \text{Enc}_{PK_{\text{med}}}(K_{\text{idx}} \parallel K_{\text{enc}}), \text{Sig}_{SK_{\text{pac}}}(\dots) \right\rangle$$

2. **Registro del Ticket en el Servidor Go:**
   - El servidor Go almacena el ticket firmado.
   - El servidor **no puede descifrar** las claves contenidas (están cifradas para $PK_{\text{med}}$).
   - El servidor valida la firma del paciente y el temporizador $T_{\text{exp}}$.

3. **Ejecución de Búsquedas por el Médico:**
   - El médico inicia sesión y descarga el ticket activo.
   - Con su clave privada $SK_{\text{med}}$, el médico descifra localmente $K_{\text{idx}}$ y $K_{\text{enc}}$ en la memoria volátil de su navegador.
   - El médico busca términos (ej: `"glucosa"`, `"biopsia"`, `"alergia penicilina"`):
     - Su navegador genera la trampa SSE-2: $L_w = \text{HMAC-SHA256}(K_{\text{idx}}, w \parallel 1)$.
     - Envía la trampa $L_w$ junto con el ID del Ticket de Delegación al servidor Go.
   - **Validación en Servidor Go:**
     - Si `CurrentTime() > T_exp` o si el paciente revocó el ticket $\rightarrow$ **HTTP 403 Forbidden (Acceso Caducado)**.
     - Si es válido $\rightarrow$ Ejecuta el lookup $T[L_w]$ en el índice invertido del paciente y retorna los documentos cifrados coincidentes.
   - El navegador del médico descifra los documentos recibidos con $K_{\text{enc}}$.

```
+--------------------------------------------------------------------------------------------------------+
|                                    FLUJO DE AUTORIZACIÓN TEMPORAL                                      |
+--------------------------------------------------------------------------------------------------------+
  PACIENTE                                   SERVIDOR GO                                     MÉDICO
     |                                            |                                             |
     | 1. Genera Ticket Temporal                  |                                             |
     |    Cifra (K_idx, K_enc) con PK_med         |                                             |
     |    Firma con SK_pac (TTL: 45 min)          |                                             |
     |                                            |                                             |
     |--- 2. POST /api/v1/delegations ----------->| (Valida firma paciente                      |
     |                                            |  Almacena delegación activa)                |
     |                                            |                                             |
     |                                            |<-- 3. GET /api/v1/delegations/active -------|
     |                                            |--- Retorna Ticket Cifrado ----------------->|
     |                                            |                                             |
     |                                            |                               4. Descifra claves con
     |                                            |                                  su SK_med en RAM
     |                                            |                                             |
     |                                            |<-- 5. POST /api/v1/search (L_w + Ticket) ---|
     |                                            |                                             |
     |                                            | (Verifica reloj < Exp_Time                  |
     |                                            |  Busca en T_paciente[L_w])                  |
     |                                            |--- Retorna Docs Cifrados ------------------>|
     |                                            |                                             |
     |                                            |                               5. Descifra Docs en RAM
     |                                            |                                  Visualiza análisis
     |                                            |                                             |
     |-- 6. [Opcional] Revocación Inmediata ----->| (Marca Ticket como REVOKED                  |
     |                                            |  Bloquea consultas subsiguientes)           |
```

---

## 4. Flujos de Trabajo Clínicos Detallados

### 4.1. Flujo A: Médico Sube un Análisis / Documento al Paciente
1. El médico ingresa al módulo *"Subir Documento Clínico"*, selecciona el paciente mediante su identificador/código médico público.
2. El cliente web del médico solicita la clave pública activa del paciente: `GET /api/v1/patients/{id}/public-key` $\rightarrow PK_{\text{pac}}$.
3. El médico adjunta el archivo (ej: PDF de informe de laboratorio, texto de consulta médica).
4. **Procesamiento en Cliente (Web Worker del Médico):**
   - Extrae el texto del documento y tokeniza las palabras clave clínicas.
   - Genera una clave simétrica de documento única $K_{\text{doc}}$ (`AES-256-GCM`).
   - Cifra el cuerpo del documento con $K_{\text{doc}}$.
   - Cifra $K_{\text{doc}}$ con la clave pública del paciente $PK_{\text{pac}}$ usando `X25519-ChaCha20-Poly1305` o `AES-KeyWrap` derivado de ECDH.
   - Cifra las etiquetas de búsqueda calculadas para el índice del paciente.
5. El cliente envía el paquete cifrado al backend Go: `POST /api/v1/documents/upload-for-patient`.
6. El backend almacena el documento cifrado en la cuenta del paciente y actualiza el índice invertido cifrado $\gamma_{\text{pac}}$.

### 4.2. Flujo B: Rotación de Clave Maestra por el Paciente
1. El paciente decide cambiar su contraseña o sospecha de una fuga de credenciales.
2. En su navegador, ingresa la clave actual y la nueva contraseña.
3. El navegador descarga todas las cabeceras de documentos y el índice cifrado.
4. Descifra todo el índice y las claves de documentos con la clave antigua.
5. Deriva el nuevo conjunto $(K_{\text{enc}}', K_{\text{idx}}', K_{\text{mask}}')$ y su nuevo par de claves $(PK_{\text{pac}}', SK_{\text{pac}}')$.
6. Re-cifra los índices y las claves de documentos con las nuevas llaves.
7. Envía el lote actualizado al servidor Go: `POST /api/v1/patient/rekey-batch`.
8. **Efecto Criptográfico:** Todos los tickets de delegación emitidos previamente quedan **matemáticamente inutilizables**, garantizando revocación perfecta hacia adelante y hacia atrás.

---

## 5. Especificación del Backend en Go (Servidor de Custodia Ciega)

### 5.1. Responsabilidades del Servidor Go
- **Custodia Ciega de Blobs:** Persistencia de documentos médicos cifrados sin posibilidad de inspección.
- **Validador de Políticas de Delegación y Control de Tiempo:** Verificación rigurosa de vigencia y firmas criptográficas en cada solicitud de búsqueda.
- **Motor SSE-2 de Alta Velocidad:** Indexación y recuperación en $O(|DB(w)|)$ con latencias sub-milisegundo.
- **Log de Auditoría Criptográfica Inmutable:** Registro firmado de cada intento de búsqueda médica (quién buscó, qué ticket usó, fecha/hora exacta e IP) para auditoría legal/HIPAA.

### 5.2. Modelo de Base de Datos Relacional (PostgreSQL)

```sql
-- Extensión para identificadores UUIDv4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tipos de roles del sistema
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'clinic_admin');

-- 1. Tabla de Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    medical_license VARCHAR(100), -- Matrícula profesional (para médicos)
    role user_role NOT NULL,
    auth_password_hash VARCHAR(255) NOT NULL, -- Hash para autenticación REST (Argon2ID servidor)
    kdf_salt BYTEA NOT NULL,                  -- Salt para derivación de claves en cliente
    public_key BYTEA NOT NULL,                -- PK pública (X25519) para recibir cifrado
    signing_public_key BYTEA NOT NULL,        -- PK pública de firma (Ed25519)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Documentos Médicos Cifrados
CREATE TABLE medical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_by_id UUID NOT NULL REFERENCES users(id),
    title_encrypted BYTEA NOT NULL,           -- Título cifrado (AES-GCM)
    doc_type VARCHAR(50) NOT NULL,            -- 'lab_result', 'prescription', 'clinical_note', 'imaging'
    encrypted_blob BYTEA NOT NULL,            -- Archivo cifrado AES-256-GCM (IV + Ciphertext + Tag)
    encrypted_key_envelope BYTEA NOT NULL,    -- Clave del documento cifrada con PK del paciente
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índice Invertido Cifrado SSE-2 del Paciente
CREATE TABLE sse_patient_index (
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lookup_label BYTEA NOT NULL,              -- L_w = HMAC(K_idx, w || 1) (32 bytes)
    encrypted_posting_list BYTEA NOT NULL,    -- Lista de IDs de documentos coincidentes cifrada
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (patient_id, lookup_label)
);

CREATE INDEX idx_sse_patient_lookup ON sse_patient_index(patient_id, lookup_label);

-- 4. Tickets de Delegación de Acceso Temporal
CREATE TABLE access_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(100) NOT NULL DEFAULT 'all', -- 'all', 'cardiology', 'general', etc.
    encrypted_keys_for_doctor BYTEA NOT NULL,  -- Enc_{PK_doc}(K_idx || K_enc)
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,          -- Fecha de caducidad estricta (TTL)
    patient_signature BYTEA NOT NULL,          -- Firma Ed25519 del paciente
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_active_delegations ON access_delegations(patient_id, doctor_id, valid_until, is_revoked);

-- 5. Log de Auditoría Médica Inmutable (Cumplimiento HIPAA / GDPR)
CREATE TABLE medical_access_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    delegation_id UUID REFERENCES access_delegations(id),
    patient_id UUID NOT NULL,
    accessor_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,              -- 'SEARCH_QUERY', 'DOCUMENT_DOWNLOAD', 'UPLOAD'
    trapdoor_hash VARCHAR(64),                -- Hash de la trampa ejecutada (no revela la palabra)
    client_ip VARCHAR(45) NOT NULL,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3. Implementación del Servicio de Búsqueda y Validación en Go

```go
package service

import (
	"context"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/osa-project/server/internal/domain"
	"github.com/osa-project/server/internal/repository"
)

var (
	ErrUnauthorizedAccess = errors.New("delegation expired, revoked or invalid")
	ErrPatientNotFound    = errors.New("patient record not found")
)

type MedicalSearchService struct {
	indexRepo      repository.IndexRepository
	docRepo        repository.DocumentRepository
	delegationRepo repository.DelegationRepository
	auditRepo      repository.AuditRepository
}

func NewMedicalSearchService(
	ir repository.IndexRepository,
	dr repository.DocumentRepository,
	dl repository.DelegationRepository,
	ar repository.AuditRepository,
) *MedicalSearchService {
	return &MedicalSearchService{
		indexRepo:      ir,
		docRepo:        dr,
		delegationRepo: dl,
		auditRepo:      ar,
	}
}

// SearchAsDoctor ejecuta una búsqueda cifrada delegada con validación de TTL
func (s *MedicalSearchService) SearchAsDoctor(
	ctx context.Context,
	doctorID uuid.UUID,
	patientID uuid.UUID,
	delegationID uuid.UUID,
	labelHex string,
	clientIP string,
) ([]domain.EncryptedDocumentResult, error) {

	// 1. Validar rigurosamente el Ticket de Delegación Temporal
	delegation, err := s.delegationRepo.GetActiveDelegation(ctx, delegationID)
	if err != nil || delegation == nil {
		return nil, ErrUnauthorizedAccess
	}

	// Comprobación de integridad y tiempo (Zero-Trust)
	now := time.Now().UTC()
	if delegation.PatientID != patientID ||
		delegation.DoctorID != doctorID ||
		delegation.IsRevoked ||
		now.Before(delegation.ValidFrom) ||
		now.After(delegation.ValidUntil) {
		return nil, ErrUnauthorizedAccess
	}

	// 2. Decodificar la trampa de búsqueda SSE-2
	labelBytes, err := hex.DecodeString(labelHex)
	if err != nil {
		return nil, errors.New("invalid trapdoor encoding")
	}

	// 3. Registrar auditoría legal inmutable
	_ = s.auditRepo.LogAccess(ctx, domain.AuditEntry{
		DelegationID: delegationID,
		PatientID:    patientID,
		AccessorID:   doctorID,
		Action:       "SEARCH_QUERY",
		TrapdoorHash: hex.EncodeToString(labelBytes[:8]), // Truncado para auditoría
		ClientIP:     clientIP,
		Timestamp:    now,
	})

	// 4. Búsqueda directa en el índice invertido cifrado del paciente O(1)
	entry, err := s.indexRepo.FindByPatientAndLabel(ctx, patientID, labelBytes)
	if err != nil {
		return nil, err
	}
	if entry == nil {
		// Búsqueda ciega sin coincidencias
		return []domain.EncryptedDocumentResult{}, nil
	}

	// 5. Resolver la lista de distribución y recuperar documentos cifrados
	docIDs, err := s.indexRepo.ResolvePostingList(ctx, entry.EncryptedPostingList)
	if err != nil {
		return nil, err
	}

	return s.docRepo.GetDocumentsByIDs(ctx, patientID, docIDs)
}
```

---

## 6. Especificación del Frontend (React + TypeScript + WebCrypto)

### 6.1. Separación de Portales por Rol
La interfaz React se divide en dos flujos especializados:

#### A. Portal del Paciente (`/patient/*`)
- **Panel de Control de Privacidad:** Lista en tiempo real de médicos con acceso activo con contador de tiempo restante (*TTL countdown*).
- **Botón de Revocación de Pánico:** Invalidación en 1-click de cualquier permiso concedido.
- **Asistente de Delegación Rápida:** Generación de código QR o enlace temporal firmado para el médico en sala de consulta.
- **Historial Médico Descifrado:** Visor de consultas, recetas, laboratorios y estudios con buscador SSE-2 reactivo.
- **Rotación y Respaldo de Llave Maestra:** Generación de frase mnemónica (BIP-39) para recuperación de emergencia.

#### B. Portal del Médico / Clínica (`/doctor/*`)
- **Acceso Temporal a Paciente:** Validación de código de autorización y descifrado de llaves efímeras en RAM.
- **Buscador Clínico Cifrado:** Búsqueda instantánea de patologías, valores de laboratorio y medicamentos mediante generación de trapdoors.
- **Módulo de Carga Clínica:** Subida de notas médicas y PDFs de laboratorio cifrados automáticamente con la $PK$ del paciente.
- **Indicador de Sesión Segura:** Barra de estado visual que alerta sobre el tiempo restante de acceso autorizado.

### 6.2. Módulo de Delegación Criptográfica (`delegationCrypto.ts`)

```typescript
/**
 * delegationCrypto.ts
 * Generación de Tickets de Delegación Temporal y Cifrado Asimétrico ECIES/X25519
 */

export interface DelegationTicketPayload {
  patientId: string;
  doctorId: string;
  scope: string;
  validFrom: string;
  validUntil: string;
  encryptedKeysForDoctorBase64: string;
  patientSignatureHex: string;
}

export class DelegationCryptoService {
  /**
   * Paciente empaqueta y cifra sus claves de búsqueda y descifrado para el médico
   */
  public static async createDelegationTicket(
    patientId: string,
    doctorId: string,
    doctorPublicKeyRaw: Uint8Array,
    patientSigningKey: CryptoKey,
    rawEncKey: Uint8Array,
    rawIdxKey: Uint8Array,
    durationMinutes: number
  ): Promise<DelegationTicketPayload> {
    const now = new Date();
    const validUntil = new Date(now.getTime() + durationMinutes * 60000);

    // 1. Generar par efímero X25519 para ECDH con el médico
    const ephemeralKeyPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );

    // Importar la clave pública del médico
    const doctorPubKey = await window.crypto.subtle.importKey(
      "raw",
      doctorPublicKeyRaw,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    // Derivar clave de cifrado compartida
    const sharedKey = await window.crypto.subtle.deriveKey(
      { name: "ECDH", public: doctorPubKey },
      ephemeralKeyPair.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    // 2. Empaquetar K_enc (32 bytes) + K_idx (32 bytes)
    const keyBundle = new Uint8Array(64);
    keyBundle.set(rawEncKey, 0);
    keyBundle.set(rawIdxKey, 32);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBundle = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      sharedKey,
      keyBundle
    );

    // Exportar clave pública efímera para adjuntarla al payload
    const exportedEphemeralPub = new Uint8Array(
      await window.crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey)
    );

    // Payload empaquetado: EphemeralPub (65B) + IV (12B) + EncryptedBundle
    const combined = new Uint8Array(exportedEphemeralPub.length + iv.length + encryptedBundle.byteLength);
    combined.set(exportedEphemeralPub, 0);
    combined.set(iv, exportedEphemeralPub.length);
    combined.set(new Uint8Array(encryptedBundle), exportedEphemeralPub.length + iv.length);

    const encryptedKeysBase64 = btoa(String.fromCharCode(...combined));

    // 3. Crear mensaje a firmar para no repudio
    const messageToSign = `${patientId}|${doctorId}|${now.toISOString()}|${validUntil.toISOString()}|${encryptedKeysBase64}`;
    const signBuffer = await window.crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      patientSigningKey,
      new TextEncoder().encode(messageToSign)
    );

    const signatureHex = Array.from(new Uint8Array(signBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      patientId,
      doctorId,
      scope: "all",
      validFrom: now.toISOString(),
      validUntil: validUntil.toISOString(),
      encryptedKeysForDoctorBase64: encryptedKeysBase64,
      patientSignatureHex: signatureHex
    };
  }
}
```

---

## 7. Políticas de Seguridad Restrictivas Iniciales (Hardened Mode)

Para cumplir con normativas médicas estrictas, el sistema arranca con las siguientes políticas restrictivas (que luego podrán parametrizarse):

1. **Duración Máxima de Delegación:** Limitada por defecto a un máximo de **120 minutos** por sesión médica. No se permiten permisos indefinidos.
2. **Aislamiento Criptográfico de Sesión:** Las claves descifradas por el médico residen **únicamente en variables de memoria volátil**. Prohibido estrictamente el almacenamiento en `localStorage`, `sessionStorage` o `IndexedDB` en el dispositivo del médico.
3. **Cierre de Sesión Automático:** El cliente del médico destruye (`zero-fill`) las claves de memoria tras 10 minutos de inactividad del cursor o cambio de pestaña.
4. **Protección contra Inferencia de Diagnósticos (Padding de Frecuencia):**
   - Todos los documentos cifrados se rellenan (*padding*) a bloques estándar de tamaño fijo (ej. múltiplos de 64 KB) para que el tamaño del archivo no revele el tipo de análisis (ej: una analítica simple vs un informe oncológico extenso).
   - Inserción de palabras clave señuelo (*dummy trapdoors*) en lotes de búsqueda para ocultar el número exacto de términos consultados.
5. **Auditoría Legal Inmutable:** Todo acceso médico genera un registro inmutable con marca de tiempo garantizada por el servidor y hash de la solicitud.

---

## 8. Estructura del Código en el Repositorio

```
osa/
├── docs/
│   └── ESPECIFICACION_TECNICA_SSE2.md   # Esta especificación técnica
├── server/                              # Backend en Go
│   ├── cmd/api/main.go                  # Entrada del servidor HTTP
│   ├── internal/
│   │   ├── domain/                      # Modelos: Usuario, Documento, Delegación, Auditoría
│   │   ├── repository/postgres/         # Persistencia PostgreSQL (pgx)
│   │   ├── service/
│   │   │   ├── auth_service.go          # Autenticación y registro de claves públicas
│   │   │   ├── delegation_service.go    # Gestión de TTL y validación de firmas
│   │   │   ├── document_service.go      # Custodia de blobs y sobres cifrados
│   │   │   └── sse_search_service.go    # Motor SSE-2 de búsqueda invertida
│   │   └── transport/http/              # Controladores REST y middlewares
│   ├── go.mod
│   └── Dockerfile
└── client/                              # Frontend React + TypeScript + Vite
    ├── src/
    │   ├── crypto/
    │   │   ├── sseCore.ts               # PRF, HMAC-SHA256, Trapdoors L_w
    │   │   ├── aesGcm.ts                # Cifrado y descifrado autenticado de archivos
    │   │   ├── delegationCrypto.ts      # Envolturas asimétricas y firmas digitales
    │   │   └── keyDerivation.ts         # KDF Argon2id / PBKDF2
    │   ├── workers/
    │   │   └── textIndexer.worker.ts    # Tokenización y hashing en segundo plano
    │   ├── components/
    │   │   ├── patient/                 # Vistas del Paciente (Consentimientos, Visor, QR)
    │   │   ├── doctor/                  # Vistas del Médico (Buscador, Temporizador, Carga)
    │   │   └── common/                  # UI Components (Alertas, Badges de Tiempo, Modales)
    │   ├── context/
    │   │   ├── AuthContext.tsx
    │   │   └── CryptoSessionContext.tsx # Almacén seguro volátil de claves en RAM
    │   └── App.tsx
    └── package.json
```
