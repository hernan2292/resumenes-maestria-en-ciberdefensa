// Generación y consumo del Ticket Criptográfico de Delegación Temporal
// (TCDT), Sección 3.1. Corrige el ejemplo original de la spec (adenda
// punto 10): usa X25519/Ed25519 reales (@noble/curves) en vez de ECDH
// P-256 de WebCrypto, y firma un mensaje que incluye 'scope'/'scopeLabel'
// (adenda punto 2) para que no puedan alterarse después de firmados.
import { eciesEncrypt, eciesDecrypt, sign, verify } from './keyExchange';
import { bytesToHex, hexToBytes, toRFC3339NoMillis, concatBytes, utf8ToBytes, bytesToBase64, base64ToBytes } from './encoding';

export interface DelegationTicketDraft {
  doctorId: string;
  scope: string; // "all" o nombre libre de categoría
  scopeLabelHex?: string;
  encryptedKeysForDoctorB64: string;
  validFrom: string; // RFC3339 sin milisegundos — ver encoding.ts
  validUntil: string;
  patientSignatureHex: string;
}

/**
 * Debe producir BYTE A BYTE el mismo mensaje que
 * server/internal/service/delegation_service.go:CanonicalSigningMessage.
 * Cualquier cambio acá requiere el cambio espejo del lado del servidor.
 */
function canonicalSigningMessage(params: {
  patientId: string;
  doctorId: string;
  scope: string;
  scopeLabelHex: string; // "" si no hay
  validFrom: string;
  validUntil: string;
  encryptedKeysForDoctorB64: string;
}): Uint8Array {
  const msg = [
    params.patientId,
    params.doctorId,
    params.scope,
    params.scopeLabelHex,
    params.validFrom,
    params.validUntil,
    params.encryptedKeysForDoctorB64,
  ].join('|');
  return utf8ToBytes(msg);
}

export interface CreateDelegationParams {
  patientId: string;
  doctorId: string;
  doctorPublicKey: Uint8Array; // X25519, obtenida vía GET /users/by-code/{code}
  patientSigningSecretKey: Uint8Array; // Ed25519 SK del paciente, sólo en RAM
  kIdx: Uint8Array;
  kEnc: Uint8Array;
  scope: string; // "all" o categoría elegida por el paciente
  scopeLabelHex?: string; // requerido si scope != "all" (ver sseCore.computeScopeLabelHex)
  durationMinutes: number; // se valida <=120 también en el servidor (adenda punto 12)
}

export async function createDelegationTicket(params: CreateDelegationParams): Promise<DelegationTicketDraft> {
  if (params.durationMinutes <= 0 || params.durationMinutes > 120) {
    throw new Error('la duración de la delegación debe estar entre 1 y 120 minutos');
  }

  const now = new Date();
  const validFrom = toRFC3339NoMillis(now);
  const validUntil = toRFC3339NoMillis(new Date(now.getTime() + params.durationMinutes * 60_000));

  const keyBundle = concatBytes(params.kIdx, params.kEnc); // 64 bytes: K_idx(32) || K_enc(32)
  const encryptedKeys = await eciesEncrypt(params.doctorPublicKey, keyBundle, 'delegation-keys');
  const encryptedKeysForDoctorB64 = bytesToBase64(encryptedKeys);

  const scopeLabelHex = params.scopeLabelHex ?? '';
  const message = canonicalSigningMessage({
    patientId: params.patientId,
    doctorId: params.doctorId,
    scope: params.scope,
    scopeLabelHex,
    validFrom,
    validUntil,
    encryptedKeysForDoctorB64,
  });
  const signature = sign(message, params.patientSigningSecretKey);

  return {
    doctorId: params.doctorId,
    scope: params.scope,
    scopeLabelHex: params.scopeLabelHex,
    encryptedKeysForDoctorB64,
    validFrom,
    validUntil,
    patientSignatureHex: bytesToHex(signature),
  };
}

/** Verificación local opcional (defensa en profundidad): el paciente puede
 * re-verificar su propia firma antes de enviarla, detectando bugs de
 * codificación antes de que el servidor los rechace. */
export function verifyOwnSignature(
  draft: DelegationTicketDraft,
  patientId: string,
  patientSigningPublicKey: Uint8Array
): boolean {
  const message = canonicalSigningMessage({
    patientId,
    doctorId: draft.doctorId,
    scope: draft.scope,
    scopeLabelHex: draft.scopeLabelHex ?? '',
    validFrom: draft.validFrom,
    validUntil: draft.validUntil,
    encryptedKeysForDoctorB64: draft.encryptedKeysForDoctorB64,
  });
  return verify(hexToBytes(draft.patientSignatureHex), message, patientSigningPublicKey);
}

export interface UnwrappedDelegationKeys {
  kIdx: Uint8Array;
  kEnc: Uint8Array;
}

/** El médico descifra localmente K_idx||K_enc con su SK_med (sólo en RAM,
 * ver CryptoSessionContext.tsx). Nunca se persiste. */
export async function unwrapDelegationKeys(
  doctorSecretKey: Uint8Array,
  encryptedKeysForDoctorB64: string
): Promise<UnwrappedDelegationKeys> {
  const raw = base64ToBytes(encryptedKeysForDoctorB64);
  const bundle = await eciesDecrypt(doctorSecretKey, raw, 'delegation-keys');
  if (bundle.length !== 64) {
    throw new Error('bundle de claves de delegación con longitud inesperada');
  }
  return { kIdx: bundle.slice(0, 32), kEnc: bundle.slice(32, 64) };
}
