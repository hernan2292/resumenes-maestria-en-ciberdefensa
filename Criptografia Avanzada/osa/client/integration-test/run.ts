// Test de integración end-to-end con criptografía REAL contra el backend Go
// + Postgres real (no mocks): reutiliza el mismo código TypeScript que usa
// el navegador (ApiClient, keyDerivation, delegationCrypto, documentCrypto,
// indexing, rekey) para validar que el sistema completo funciona como
// describe la especificación y la adenda, de punta a punta.
//
// Se corre con: npx tsx integration-test/run.ts
// (requiere el servidor Go escuchando en http://127.0.0.1:8080 con una base
// Postgres vacía o limpia — ver README para cómo levantarlo).

import { ApiClient, ApiError } from '../src/api/client';
import { deriveKeys, generateKDFSalt } from '../src/crypto/keyDerivation';
import { bytesToBase64, base64ToBytes } from '../src/crypto/encoding';
import { createDelegationTicket, unwrapDelegationKeys } from '../src/crypto/delegationCrypto';
import { computeScopeLabelHex } from '../src/crypto/sseCore';
import { uploadDocument, fetchAndDecryptOwnDocument, fetchAndDecryptDocumentAsDoctor } from '../src/services/documentCrypto';
import { searchWords, processPendingIndexItem } from '../src/services/indexing';
import { performRekey } from '../src/services/rekey';
import type {
  RegisterResponse,
  LoginResponse,
  PublicUserResponse,
  DocumentResponse,
  DelegationResponse,
  ActiveDelegationForDoctorResponse,
  PendingIndexItemResponse,
} from '../src/api/types';

const BASE_URL = process.env.OSA_API_URL ?? 'http://127.0.0.1:8080';

let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectApiError(label: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(label, false, 'no lanzó error');
  } catch (err) {
    if (err instanceof ApiError && err.status === status) {
      ok(label, true);
    } else {
      ok(label, false, err instanceof Error ? err.message : String(err));
    }
  }
}

// Genera un TOTP RFC 6238 (SHA1, 6 dígitos, período 30s) a partir de un
// secreto base32 — para poder completar el flujo real de enable/login sin
// intervención humana en el test.
function base32Decode(b32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = b32.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function totpCode(secretB32: string, timeStepSeconds = 30, digits = 6): Promise<string> {
  const key = base32Decode(secretB32);
  const counter = Math.floor(Date.now() / 1000 / timeStepSeconds);
  const counterBytes = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBytes as BufferSource));
  const offset = mac[mac.length - 1] & 0x0f;
  const binCode =
    ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) | ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  const code = (binCode % 10 ** digits).toString().padStart(digits, '0');
  return code;
}

function otpauthSecret(uri: string): string {
  const match = /[?&]secret=([A-Z2-7=]+)/i.exec(uri);
  if (!match) throw new Error(`no se encontró "secret=" en el otpauth URI: ${uri}`);
  return match[1];
}

async function main() {
  console.log(`\nOSA — test de integración end-to-end contra ${BASE_URL}\n`);

  const api = new ApiClient({ getToken: () => null });
  let bearer: string | null = null;
  const apiAs = (): ApiClient => new ApiClient({ getToken: () => bearer });

  // --- 1. Registro de paciente ---
  console.log('1. Registro y login del paciente');
  const patientEmail = `patient-${Date.now()}@example.test`;
  const patientPassword = 'super-secreta-123456';
  const patientKdfSalt = generateKDFSalt();
  const patientKeys = await deriveKeys(patientPassword, patientKdfSalt);

  const patientReg = await api.post<RegisterResponse>('/api/v1/auth/register', {
    email: patientEmail,
    password: patientPassword,
    role: 'patient',
    kdf_salt_base64: bytesToBase64(patientKdfSalt),
    public_key_base64: bytesToBase64(patientKeys.identity.publicKey),
    signing_public_key_base64: bytesToBase64(patientKeys.signingIdentity.publicKey),
  });
  ok('paciente registrado con public_code', /^OSA-/.test(patientReg.public_code), patientReg.public_code);

  const patientLogin = await api.post<LoginResponse>('/api/v1/auth/login', { email: patientEmail, password: patientPassword });
  ok('login de paciente exitoso', patientLogin.role === 'patient');
  bearer = patientLogin.access_token;
  let patientApi = apiAs();
  const patientId = patientLogin.user_id;

  // --- 2. Registro de médico (sin TOTP todavía) ---
  console.log('\n2. Registro y login del médico');
  const doctorEmail = `doctor-${Date.now()}@example.test`;
  const doctorPassword = 'otra-secreta-654321';
  const doctorKdfSalt = generateKDFSalt();
  const doctorKeys = await deriveKeys(doctorPassword, doctorKdfSalt);

  const doctorReg = await api.post<RegisterResponse>('/api/v1/auth/register', {
    email: doctorEmail,
    password: doctorPassword,
    role: 'doctor',
    medical_license: 'MP-12345',
    kdf_salt_base64: bytesToBase64(doctorKdfSalt),
    public_key_base64: bytesToBase64(doctorKeys.identity.publicKey),
    signing_public_key_base64: bytesToBase64(doctorKeys.signingIdentity.publicKey),
  });
  ok('médico registrado con public_code', /^OSA-/.test(doctorReg.public_code));

  const doctorLogin = await api.post<LoginResponse>('/api/v1/auth/login', { email: doctorEmail, password: doctorPassword });
  bearer = doctorLogin.access_token;
  let doctorApi = apiAs();
  const doctorId = doctorLogin.user_id;

  // --- 3. Paciente sube un documento propio (indexado en el acto) ---
  console.log('\n3. Paciente sube y busca un documento propio');
  bearer = patientLogin.access_token;
  patientApi = apiAs();
  const uploaded = await uploadDocument({
    api: patientApi,
    patientId,
    patientPublicKey: patientKeys.identity.publicKey,
    title: 'Análisis de sangre',
    docType: 'lab_result',
    contentText: 'Glucosa en ayunas: 95 mg/dL. Colesterol total: 180 mg/dL.',
    categories: ['endocrinologia'],
    liveKeys: { kIdx: patientKeys.kIdx, kEnc: patientKeys.kEnc },
  });
  ok('documento subido', !!uploaded.document_id);

  const searchOwn = await searchWords({
    api: patientApi,
    kIdx: patientKeys.kIdx,
    kEnc: patientKeys.kEnc,
    patientId,
    words: ['glucosa'],
    dummyCount: 2,
  });
  ok('búsqueda propia encuentra el documento', searchOwn[0]?.documentIds.includes(uploaded.document_id) ?? false);

  const decryptedOwn = await fetchAndDecryptOwnDocument(patientApi, patientId, uploaded.document_id, patientKeys.identity.secretKey);
  ok('paciente puede descifrar su propio documento', decryptedOwn.content.includes('Glucosa'));

  // --- 4. Sin TOTP, el médico NO puede consumir delegación (adenda #18) ---
  console.log('\n4. Enforcement de MFA obligatorio para médico (adenda punto 18)');
  // Primero necesitamos una delegación creada para poder intentar consumirla.
  const scopeLabelHex = computeScopeLabelHex(patientKeys.kIdx, 'endocrinologia');
  const draft1 = await createDelegationTicket({
    patientId,
    doctorId,
    doctorPublicKey: doctorKeys.identity.publicKey,
    patientSigningSecretKey: patientKeys.signingIdentity.secretKey,
    kIdx: patientKeys.kIdx,
    kEnc: patientKeys.kEnc,
    scope: 'endocrinologia',
    scopeLabelHex,
    durationMinutes: 15,
  });
  const delegation1 = await patientApi.post<DelegationResponse>('/api/v1/delegations', {
    doctor_id: draft1.doctorId,
    scope: draft1.scope,
    scope_label_hex: draft1.scopeLabelHex,
    encrypted_keys_for_doctor_base64: draft1.encryptedKeysForDoctorB64,
    valid_from: draft1.validFrom,
    valid_until: draft1.validUntil,
    patient_signature_hex: draft1.patientSignatureHex,
  });
  ok('delegación con alcance creada', !!delegation1.id);

  bearer = doctorLogin.access_token;
  doctorApi = apiAs();
  await expectApiError('GET /delegations/active devuelve 428 sin TOTP', 428, () =>
    doctorApi.get(`/api/v1/delegations/active?patient_id=${patientId}`)
  );

  // --- 5. Médico activa TOTP y reintenta ---
  console.log('\n5. Médico activa TOTP');
  const setupRes = await doctorApi.post<{ otpauth_uri: string }>('/api/v1/auth/totp/setup');
  const secret = otpauthSecret(setupRes.otpauth_uri);
  const code1 = await totpCode(secret);
  await doctorApi.post('/api/v1/auth/totp/enable', { code: code1 });
  ok('TOTP habilitado', true);

  const active = await doctorApi.get<ActiveDelegationForDoctorResponse>(`/api/v1/delegations/active?patient_id=${patientId}`);
  ok('con TOTP, GET /delegations/active ahora funciona', active.id === delegation1.id);
  const unwrapped = await unwrapDelegationKeys(doctorKeys.identity.secretKey, active.encrypted_keys_for_doctor_base64);
  ok('médico descifra K_idx/K_enc de la delegación', unwrapped.kIdx.length === 32 && unwrapped.kEnc.length === 32);

  // --- 6. Médico busca y lee el documento con alcance restringido ---
  console.log('\n6. Médico busca y lee vía delegación con alcance');
  const doctorSearch = await searchWords({
    api: doctorApi,
    kIdx: unwrapped.kIdx,
    kEnc: unwrapped.kEnc,
    patientId,
    delegationId: active.id,
    words: ['glucosa'],
  });
  ok('médico encuentra el documento por búsqueda delegada', doctorSearch[0]?.documentIds.includes(uploaded.document_id) ?? false);

  const decryptedByDoctor = await fetchAndDecryptDocumentAsDoctor(doctorApi, patientId, uploaded.document_id, active.id, unwrapped.kEnc);
  ok('médico descifra el documento vía sobre simétrico', decryptedByDoctor.content.includes('Glucosa'));

  // --- 7. Médico sube un documento SIN delegación activa -> needs_indexing ---
  console.log('\n7. Documento subido sin K_idx queda "por indexar" (adenda punto 16)');
  bearer = patientLogin.access_token;
  // Revocamos la delegación con alcance para simular "sin delegación activa".
  const revokeRes = await patientApi.post<{ revoked: boolean }>(`/api/v1/delegations/${delegation1.id}/revoke`);
  ok('paciente revoca la delegación (botón de pánico)', revokeRes.revoked === true);

  bearer = doctorLogin.access_token;
  doctorApi = apiAs();
  const patientPublic = await doctorApi.get<PublicUserResponse>(`/api/v1/users/by-code/${patientReg.public_code}`);
  const asyncUpload = await uploadDocument({
    api: doctorApi,
    patientId,
    patientPublicKey: base64ToBytes(patientPublic.public_key_base64),
    title: 'Informe de laboratorio externo',
    docType: 'lab_result',
    contentText: 'Hemoglobina glicosilada: 5.4%.',
    categories: [],
    // sin liveKeys: no tiene delegación activa
  });
  ok('documento subido sin delegación activa', !!asyncUpload.document_id);

  bearer = patientLogin.access_token;
  patientApi = apiAs();
  const pendingList = await patientApi.get<PendingIndexItemResponse[]>('/api/v1/patients/me/pending-index');
  ok('el documento aparece en "por indexar"', pendingList.some((p) => p.document_id === asyncUpload.document_id));

  await processPendingIndexItem({
    api: patientApi,
    patientId,
    identitySecretKey: patientKeys.identity.secretKey,
    kIdx: patientKeys.kIdx,
    kEnc: patientKeys.kEnc,
    documentId: asyncUpload.document_id,
  });
  const pendingAfter = await patientApi.get<PendingIndexItemResponse[]>('/api/v1/patients/me/pending-index');
  ok('tras procesarlo, ya no aparece pendiente', !pendingAfter.some((p) => p.document_id === asyncUpload.document_id));

  const searchAfterProcess = await searchWords({
    api: patientApi,
    kIdx: patientKeys.kIdx,
    kEnc: patientKeys.kEnc,
    patientId,
    words: ['hemoglobina'],
  });
  ok('el documento procesado ya es buscable', searchAfterProcess[0]?.documentIds.includes(asyncUpload.document_id) ?? false);

  // --- 8. Revocación efectivamente bloquea acceso nuevo ---
  console.log('\n8. La delegación revocada ya no puede volver a consumirse');
  bearer = doctorLogin.access_token;
  doctorApi = apiAs();
  await expectApiError('GET /delegations/active tras revocar -> 404', 404, () =>
    doctorApi.get(`/api/v1/delegations/active?patient_id=${patientId}`)
  );

  // --- 9. Rotación de clave maestra (Flujo B / adenda punto 19) ---
  console.log('\n9. Rotación de clave maestra: el historial completo sigue siendo legible después');
  bearer = patientLogin.access_token;
  patientApi = apiAs();
  const newPassword = 'clave-nueva-post-compromiso-000';
  const outcome = await performRekey({
    api: patientApi,
    patientId,
    newPassword,
    oldIdentitySecretKey: patientKeys.identity.secretKey,
  });
  ok('rekey re-envolvió ambos documentos existentes', outcome.documentsRewrapped === 2, `documentsRewrapped=${outcome.documentsRewrapped}`);

  // Login con la password vieja debe fallar ahora; con la nueva debe andar.
  await expectApiError('login con password vieja falla tras rekey', 401, () =>
    api.post('/api/v1/auth/login', { email: patientEmail, password: patientPassword })
  );
  const loginAfterRekey = await api.post<LoginResponse>('/api/v1/auth/login', { email: patientEmail, password: newPassword });
  bearer = loginAfterRekey.access_token;
  patientApi = apiAs();
  ok('login con password nueva funciona', loginAfterRekey.role === 'patient');

  const doc1AfterRekey = await fetchAndDecryptOwnDocument(patientApi, patientId, uploaded.document_id, outcome.newKeys.identity.secretKey);
  ok('documento 1 sigue siendo descifrable con la identidad nueva', doc1AfterRekey.content.includes('Glucosa'));
  const doc2AfterRekey = await fetchAndDecryptOwnDocument(patientApi, patientId, asyncUpload.document_id, outcome.newKeys.identity.secretKey);
  ok('documento 2 sigue siendo descifrable con la identidad nueva', doc2AfterRekey.content.includes('Hemoglobina'));

  const searchAfterRekey = await searchWords({
    api: patientApi,
    kIdx: outcome.newKeys.kIdx,
    kEnc: outcome.newKeys.kEnc,
    patientId,
    words: ['glucosa', 'hemoglobina'],
  });
  ok(
    'el índice reconstruido con la clave nueva encuentra ambos documentos',
    (searchAfterRekey.find((r) => r.word === 'glucosa')?.documentIds.includes(uploaded.document_id) ?? false) &&
      (searchAfterRekey.find((r) => r.word === 'hemoglobina')?.documentIds.includes(asyncUpload.document_id) ?? false)
  );

  const delegationsAfterRekey = await patientApi.get<DelegationResponse[]>('/api/v1/delegations/mine');
  ok('rekey revocó todas las delegaciones (activas quedan en 0)', delegationsAfterRekey.length === 0);

  // --- Resumen ---
  console.log(`\n${passed} pasos OK, ${failed} fallidos.\n`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nERROR NO MANEJADO EN EL TEST:', err);
  process.exitCode = 1;
});
