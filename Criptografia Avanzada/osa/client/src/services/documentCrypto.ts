// Orquestación de subida/descarga de documentos (Sección 4.1; adenda punto
// 16: K_doc efímera por documento cifra título+tipo+contenido; viaja
// envuelta con ECIES para PK_pac (siempre) y, cuando quien sube tiene
// K_enc en ese momento, TAMBIÉN con AES-GCM bajo K_enc — es ese segundo
// sobre el que le permite a un médico delegado leer el documento sin
// depender de SK_pac, que nunca posee).
import type { ApiClient } from '../api/client';
import type { DocumentResponse } from '../api/types';
import { randomBytes, bytesToBase64, base64ToBytes } from '../crypto/encoding';
import { encryptDocumentBlob, decryptDocumentBlob, encryptSmall, decryptSmall } from '../crypto/aesGcm';
import { eciesEncrypt, eciesDecrypt } from '../crypto/keyExchange';
import { computeScopeLabelHex } from '../crypto/sseCore';
import { tokenizeAsync } from '../crypto/tokenizeAsync';
import { addDocumentToOwnIndex } from './indexing';

export const DOCUMENT_KEY_ENVELOPE_TAG = 'document-key';

export interface UploadDocumentParams {
  api: ApiClient;
  patientId: string;
  patientPublicKey: Uint8Array; // PK_pac, propia o consultada vía by-code
  title: string;
  docType: string;
  contentText: string; // MVP: documentos de texto plano (notas, resultados transcriptos)
  categories: string[]; // para las scope labels (adenda punto 2); vacío = sin restricción de alcance
  /**
   * Presente cuando quien sube TIENE K_idx/K_enc en este momento: el
   * propio paciente (siempre), o un médico/clínica con una delegación
   * activa consumida (ver CryptoSessionContext). En ese caso se indexa con
   * trapdoors reales en el acto y se agrega el sobre simétrico rápido.
   * Si se omite, el documento queda `needs_indexing=true` y sólo el
   * paciente podrá leerlo (vía SK_pac) hasta que lo procese.
   */
  liveKeys?: { kIdx: Uint8Array; kEnc: Uint8Array; delegationId?: string };
}

export async function uploadDocument(params: UploadDocumentParams): Promise<DocumentResponse> {
  const kDoc = randomBytes(32);
  const titleCt = await encryptSmall(kDoc, new TextEncoder().encode(params.title));
  const docTypeCt = await encryptSmall(kDoc, new TextEncoder().encode(params.docType));
  const blobCt = await encryptDocumentBlob(kDoc, new TextEncoder().encode(params.contentText));
  const asymmetricEnvelope = await eciesEncrypt(params.patientPublicKey, kDoc, DOCUMENT_KEY_ENVELOPE_TAG);

  let symmetricEnvelopeB64: string | undefined;
  let scopeLabelsHex: string[] = [];
  if (params.liveKeys) {
    const symmetricEnvelope = await encryptSmall(params.liveKeys.kEnc, kDoc);
    symmetricEnvelopeB64 = bytesToBase64(symmetricEnvelope);
    scopeLabelsHex = params.categories.map((c) => computeScopeLabelHex(params.liveKeys!.kIdx, c));
  }

  const doc = await params.api.post<DocumentResponse>('/api/v1/documents/upload-for-patient', {
    patient_id: params.patientId,
    title_encrypted_base64: bytesToBase64(titleCt),
    doc_type_encrypted_base64: bytesToBase64(docTypeCt),
    encrypted_blob_base64: bytesToBase64(blobCt),
    encrypted_key_envelope_base64: bytesToBase64(asymmetricEnvelope),
    encrypted_key_envelope_symmetric_base64: symmetricEnvelopeB64,
    scope_labels_hex: scopeLabelsHex,
    needs_indexing: !params.liveKeys,
  });

  if (params.liveKeys) {
    const keywords = await tokenizeAsync(`${params.title} ${params.docType} ${params.contentText}`);
    await addDocumentToOwnIndex({
      api: params.api,
      kIdx: params.liveKeys.kIdx,
      kEnc: params.liveKeys.kEnc,
      patientId: params.patientId,
      delegationId: params.liveKeys.delegationId,
      documentId: doc.document_id,
      keywords,
    });
  }

  kDoc.fill(0);
  return doc;
}

export interface DecryptedDocument {
  documentId: string;
  uploadedById: string;
  title: string;
  docType: string;
  content: string;
  createdAt: string;
}

/** Exportada además como utilidad para services/rekey.ts: durante la
 * rotación de identidad (adenda punto 19) el paciente necesita descifrar
 * TODOS sus documentos con la K_doc obtenida vía la identidad vieja, tanto
 * para re-tokenizar (nuevo índice) como para reenvolver la K_doc para la
 * identidad nueva. */
export async function decryptWithKDoc(doc: DocumentResponse, kDoc: Uint8Array): Promise<DecryptedDocument> {
  const title = new TextDecoder().decode(await decryptSmall(kDoc, base64ToBytes(doc.title_encrypted_base64)));
  const docType = new TextDecoder().decode(await decryptSmall(kDoc, base64ToBytes(doc.doc_type_encrypted_base64)));
  const content = new TextDecoder().decode(await decryptDocumentBlob(kDoc, base64ToBytes(doc.encrypted_blob_base64)));
  return { documentId: doc.document_id, uploadedById: doc.uploaded_by_id, title, docType, content, createdAt: doc.created_at };
}

/** El propio paciente: siempre puede, vía SK_pac (sobre asimétrico, always presente). */
export async function fetchAndDecryptOwnDocument(
  api: ApiClient,
  patientId: string,
  documentId: string,
  identitySecretKey: Uint8Array
): Promise<DecryptedDocument> {
  const { result } = await fetchAndDecryptOwnDocumentWithKey(api, patientId, documentId, identitySecretKey);
  return result;
}

/**
 * Igual que `fetchAndDecryptOwnDocument`, pero además devuelve K_doc SIN
 * hacer zero-fill — lo usa `processPendingIndexItem` (indexing.ts) para
 * calcular el sobre simétrico de backfill sin tener que pedir y descifrar
 * el documento dos veces. El llamador es responsable de hacer
 * `kDoc.fill(0)` cuando termine de usarla.
 */
export async function fetchAndDecryptOwnDocumentWithKey(
  api: ApiClient,
  patientId: string,
  documentId: string,
  identitySecretKey: Uint8Array
): Promise<{ result: DecryptedDocument; kDoc: Uint8Array }> {
  const doc = await api.get<DocumentResponse>(`/api/v1/documents/${documentId}?patient_id=${patientId}`);
  const kDoc = await eciesDecrypt(identitySecretKey, base64ToBytes(doc.encrypted_key_envelope_base64), DOCUMENT_KEY_ENVELOPE_TAG);
  const result = await decryptWithKDoc(doc, kDoc);
  return { result, kDoc };
}

/**
 * Un médico delegado: SOLO puede leer documentos que ya tengan el sobre
 * simétrico (`encrypted_key_envelope_symmetric_base64`), porque nunca
 * posee SK_pac. Si el campo no está presente, el documento todavía no fue
 * procesado por el paciente (ver adenda punto 16) — se lanza un error
 * explícito en vez de fallar silenciosamente.
 */
export async function fetchAndDecryptDocumentAsDoctor(
  api: ApiClient,
  patientId: string,
  documentId: string,
  delegationId: string,
  kEnc: Uint8Array
): Promise<DecryptedDocument> {
  const doc = await api.get<DocumentResponse>(
    `/api/v1/documents/${documentId}?patient_id=${patientId}&delegation_id=${delegationId}`
  );
  if (!doc.encrypted_key_envelope_symmetric_base64) {
    throw new Error(
      'Este documento todavía no fue procesado por el paciente y no puede leerse desde una delegación. Pídale al paciente que abra su portal para indexarlo.'
    );
  }
  const kDoc = await decryptSmall(kEnc, base64ToBytes(doc.encrypted_key_envelope_symmetric_base64));
  const result = await decryptWithKDoc(doc, kDoc);
  kDoc.fill(0);
  return result;
}
