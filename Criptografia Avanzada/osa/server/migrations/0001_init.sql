-- Migración inicial. Corrige respecto al esquema de la especificación v2.0.0:
--   * doc_type ahora viaja cifrado (doc_type_encrypted) en vez de VARCHAR en claro.
--   * se agrega document_scope_labels para aplicar el "scope" de la delegación
--     sin que el servidor conozca la categoría real (ver docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md).
--   * se agregan campos de bloqueo por fuerza bruta y TOTP en users.
--   * medical_access_audit_logs guarda todas las acciones (upload/download/search/login),
--     no sólo búsquedas.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'clinic_admin');

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    public_code         VARCHAR(32) UNIQUE NOT NULL,
    medical_license     VARCHAR(100),
    role                user_role NOT NULL,
    auth_password_hash  VARCHAR(255) NOT NULL,
    kdf_salt            BYTEA NOT NULL,
    public_key          BYTEA NOT NULL,
    signing_public_key  BYTEA NOT NULL,
    totp_secret_enc     BYTEA,
    totp_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_count  INT NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_public_code ON users(public_code);

CREATE TABLE medical_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uploaded_by_id          UUID NOT NULL REFERENCES users(id),
    title_encrypted         BYTEA NOT NULL,
    doc_type_encrypted      BYTEA NOT NULL,
    encrypted_blob          BYTEA NOT NULL,
    -- K_doc (clave AES-256 efímera de este documento, que a su vez cifra
    -- title/doc_type/blob) envuelta con ECIES para PK_pac. SIEMPRE
    -- presente: garantiza que el paciente pueda descifrar cualquier
    -- documento sin importar quién lo subió ni si alguna vez hubo una
    -- delegación activa (ver docs/ADENDA_SEGURIDAD_Y_CORRECCIONES.md #16/#17).
    encrypted_key_envelope             BYTEA NOT NULL,
    -- La MISMA K_doc, envuelta simétricamente con AES-GCM bajo K_enc.
    -- Presente cuando quien subió el documento tenía K_enc en el momento
    -- de subir (el propio paciente siempre; un médico sólo si en ese
    -- momento tenía una delegación activa). Es el camino RÁPIDO que le
    -- permite a un médico delegado descifrar sin depender de SK_pac (que
    -- nunca posee) — sin este campo, un médico delegado podía buscar pero
    -- JAMÁS podía leer el contenido, un bug real que esta migración corrige.
    encrypted_key_envelope_symmetric   BYTEA,
    file_size_bytes         BIGINT NOT NULL,
    -- TRUE mientras el documento no fue indexado con trapdoors reales
    -- (subido por alguien sin K_idx en ese momento). El propio paciente lo
    -- procesa después: descifra vía SK_pac, tokeniza el contenido en claro
    -- que ya tiene, sube los trapdoors reales y — si hace falta — el sobre
    -- simétrico de arriba (ver POST /documents/{id}/confirm-indexed).
    needs_indexing          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_patient ON medical_documents(patient_id);
CREATE INDEX idx_documents_pending ON medical_documents(patient_id) WHERE needs_indexing;

CREATE TABLE sse_patient_index (
    patient_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lookup_label           BYTEA NOT NULL,
    encrypted_posting_list BYTEA NOT NULL,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (patient_id, lookup_label)
);

CREATE INDEX idx_sse_patient_lookup ON sse_patient_index(patient_id, lookup_label);

-- Etiquetas de alcance por documento (adenda punto 2). Un documento puede
-- tener 0 o más scope_label (ej. paciente puede taggearlo en varias
-- categorías); "all" no genera fila porque toda delegación con scope "all"
-- no filtra.
CREATE TABLE document_scope_labels (
    document_id UUID NOT NULL REFERENCES medical_documents(id) ON DELETE CASCADE,
    patient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_label BYTEA NOT NULL,
    PRIMARY KEY (document_id, scope_label)
);

CREATE INDEX idx_scope_labels_patient_label ON document_scope_labels(patient_id, scope_label);

CREATE TABLE access_delegations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope                       VARCHAR(100) NOT NULL DEFAULT 'all',
    scope_label                 BYTEA,
    encrypted_keys_for_doctor   BYTEA NOT NULL,
    valid_from                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until                 TIMESTAMPTZ NOT NULL,
    patient_signature           BYTEA NOT NULL,
    is_revoked                  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_delegation_max_duration CHECK (valid_until <= valid_from + INTERVAL '120 minutes')
);

CREATE INDEX idx_active_delegations ON access_delegations(patient_id, doctor_id, valid_until, is_revoked);
CREATE INDEX idx_delegations_doctor ON access_delegations(doctor_id, valid_until, is_revoked);

CREATE TABLE medical_access_audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    delegation_id   UUID REFERENCES access_delegations(id),
    patient_id      UUID NOT NULL,
    accessor_id     UUID NOT NULL,
    action          VARCHAR(50) NOT NULL,
    trapdoor_hash   VARCHAR(64),
    client_ip       VARCHAR(45) NOT NULL,
    user_agent      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_patient ON medical_access_audit_logs(patient_id, timestamp);
CREATE INDEX idx_audit_accessor ON medical_access_audit_logs(accessor_id, timestamp);

-- El log de auditoría es append-only a nivel de aplicación. Se recomienda
-- además revocar UPDATE/DELETE a nivel de rol de base de datos en producción:
--   REVOKE UPDATE, DELETE ON medical_access_audit_logs FROM osa_app;
-- dejando esos permisos sólo a un rol de mantenimiento separado usado para
-- purgas de retención documentadas (ver adenda punto 7).
