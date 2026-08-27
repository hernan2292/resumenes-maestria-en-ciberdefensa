// Orquesta la rotación soberana de clave maestra (Sección 4.2, Flujo B;
// adenda punto 19). Es la operación más delicada del cliente: si se omite
// re-envolver aunque sea UN documento para la identidad X25519 nueva, ese
// documento queda indescifrable para siempre (ni el propio paciente puede
// recuperarlo) — por eso el servidor exige (y este código construye) un
// sobre re-envuelto por cada documento existente, y el todo-o-nada ocurre
// en una única transacción del lado del servidor.
import type { ApiClient } from '../api/client';
import type { DocumentResponse } from '../api/types';
import { bytesToBase64, base64ToBytes } from '../crypto/encoding';
import { deriveKeys, generateKDFSalt, type DerivedKeys } from '../crypto/keyDerivation';
import { eciesDecrypt, eciesEncrypt } from '../crypto/keyExchange';
import { computeTrapdoorHex, encryptPostingList, mergePostingLists, type PostingList } from '../crypto/sseCore';
import { tokenizeAsync } from '../crypto/tokenizeAsync';
import { decryptWithKDoc, DOCUMENT_KEY_ENVELOPE_TAG } from './documentCrypto';

export interface RekeyParams {
  api: ApiClient;
  patientId: string;
  newPassword: string;
  /** SK_pac vieja (todavía en RAM en esta misma sesión) — imprescindible
   * para poder abrir el sobre asimétrico de cada documento existente. */
  oldIdentitySecretKey: Uint8Array;
  /** Progreso 0..1 y una etiqueta legible para la barra de la UI, ya que
   * este flujo puede tardar bastante con un historial grande (descarga +
   * descifra + re-cifra un documento a la vez). */
  onProgress?: (fraction: number, label: string) => void;
}

export interface RekeyOutcome {
  newKeys: DerivedKeys;
  documentsRewrapped: number;
}

export async function performRekey(params: RekeyParams): Promise<RekeyOutcome> {
  const { api, patientId, newPassword, oldIdentitySecretKey, onProgress } = params;

  onProgress?.(0, 'Derivando la nueva identidad criptográfica…');
  const newKdfSalt = generateKDFSalt();
  const newKeys = await deriveKeys(newPassword, newKdfSalt, (f) => onProgress?.(f * 0.2, 'Derivando la nueva identidad criptográfica…'));

  onProgress?.(0.2, 'Listando tu historial actual…');
  const list = await api.get<DocumentResponse[]>('/api/v1/patients/me/documents');

  const documentEnvelopes: { document_id: string; encrypted_key_envelope_base64: string }[] = [];
  const newIndex = new Map<string, PostingList>();

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    onProgress?.(0.2 + (0.6 * i) / Math.max(1, list.length), `Re-cifrando documento ${i + 1} de ${list.length}…`);

    // La respuesta de /patients/me/documents no trae el blob (se omite por
    // peso); se pide el documento completo puntualmente.
    const full = await api.get<DocumentResponse>(`/api/v1/documents/${item.document_id}?patient_id=${patientId}`);
    const kDoc = await eciesDecrypt(oldIdentitySecretKey, base64ToBytes(full.encrypted_key_envelope_base64), DOCUMENT_KEY_ENVELOPE_TAG);

    const decrypted = await decryptWithKDoc(full, kDoc);
    const keywords = await tokenizeAsync(`${decrypted.title} ${decrypted.docType} ${decrypted.content}`);
    for (const word of keywords) {
      const label = computeTrapdoorHex(newKeys.kIdx, word);
      const existing = newIndex.get(label) ?? { documentIds: [] };
      newIndex.set(label, mergePostingLists(existing, { documentIds: [item.document_id] }));
    }

    const newEnvelope = await eciesEncrypt(newKeys.identity.publicKey, kDoc, DOCUMENT_KEY_ENVELOPE_TAG);
    documentEnvelopes.push({ document_id: item.document_id, encrypted_key_envelope_base64: bytesToBase64(newEnvelope) });
    kDoc.fill(0);
  }

  onProgress?.(0.85, 'Cifrando el índice de búsqueda nuevo…');
  const newIndexEntries: { lookup_label_hex: string; encrypted_posting_list_base64: string }[] = [];
  for (const [labelHex, postingList] of newIndex.entries()) {
    const encrypted = await encryptPostingList(newKeys.kEnc, postingList);
    newIndexEntries.push({ lookup_label_hex: labelHex, encrypted_posting_list_base64: bytesToBase64(encrypted) });
  }

  onProgress?.(0.95, 'Subiendo la rotación (todo o nada)…');
  await api.post('/api/v1/patient/rekey-batch', {
    new_password: newPassword,
    new_kdf_salt_base64: bytesToBase64(newKdfSalt),
    new_public_key_base64: bytesToBase64(newKeys.identity.publicKey),
    new_signing_public_key_base64: bytesToBase64(newKeys.signingIdentity.publicKey),
    new_index_entries: newIndexEntries,
    new_document_key_envelopes: documentEnvelopes,
  });

  onProgress?.(1, 'Listo.');
  return { newKeys, documentsRewrapped: documentEnvelopes.length };
}
