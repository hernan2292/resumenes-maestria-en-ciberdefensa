// Mantenimiento del índice invertido cifrado SSE-2 del lado del cliente:
// agregar un documento nuevo a las posting lists de sus palabras clave,
// fusionando con lo que ya exista (Sección 5.1/5.3; adenda puntos 2 y 16),
// y ejecutar búsquedas reales con trapdoors señuelo opcionales (adenda
// punto 8).
import type { ApiClient } from '../api/client';
import type { LabelResultResponse } from '../api/types';
import { base64ToBytes, bytesToBase64 } from '../crypto/encoding';
import { encryptSmall } from '../crypto/aesGcm';
import { tokenizeAsync } from '../crypto/tokenizeAsync';
import {
  computeTrapdoorHex,
  generateDummyTrapdoors,
  encryptPostingList,
  decryptPostingList,
  mergePostingLists,
  type PostingList,
} from '../crypto/sseCore';
// Import circular con documentCrypto.ts (que a su vez importa
// addDocumentToOwnIndex de este archivo): es seguro porque ninguno de los
// dos usa el símbolo importado a nivel de módulo, sólo dentro del cuerpo de
// funciones async que corren después de que ambos módulos ya terminaron de
// inicializarse.
import { fetchAndDecryptOwnDocumentWithKey } from './documentCrypto';

const CHUNK_SIZE = 28; // deja margen bajo el tope de 32 etiquetas por lote del servidor

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface AddDocumentToIndexParams {
  api: ApiClient;
  kIdx: Uint8Array;
  kEnc: Uint8Array;
  patientId: string;
  delegationId?: string; // presente si quien indexa es un médico delegado
  documentId: string;
  keywords: string[];
}

export async function addDocumentToOwnIndex(params: AddDocumentToIndexParams): Promise<void> {
  const labelsHex = params.keywords.map((w) => computeTrapdoorHex(params.kIdx, w));

  for (const batch of chunk(labelsHex, CHUNK_SIZE)) {
    const results = await params.api.post<LabelResultResponse[]>('/api/v1/search/batch', {
      patient_id: params.patientId,
      delegation_id: params.delegationId,
      labels_hex: batch,
    });

    for (const res of results) {
      let existing: PostingList = { documentIds: [] };
      if (res.has_match && res.encrypted_posting_list_base64) {
        existing = await decryptPostingList(params.kEnc, base64ToBytes(res.encrypted_posting_list_base64));
      }
      const merged = mergePostingLists(existing, { documentIds: [params.documentId] });
      const encrypted = await encryptPostingList(params.kEnc, merged);

      await params.api.post('/api/v1/index/upsert', {
        patient_id: params.patientId,
        delegation_id: params.delegationId,
        lookup_label_hex: res.label_hex,
        encrypted_posting_list_base64: bytesToBase64(encrypted),
      });
    }
  }
}

export interface SearchWordsParams {
  api: ApiClient;
  kIdx: Uint8Array;
  kEnc: Uint8Array;
  patientId: string;
  delegationId?: string;
  words: string[];
  /** Cantidad de trapdoors señuelo a mezclar (adenda punto 8). 0 los desactiva. */
  dummyCount?: number;
}

export interface SearchWordsResult {
  word: string;
  documentIds: string[];
}

/** Búsqueda real: computa trapdoors, agrega señuelo opcional, decodifica
 * las posting lists devueltas y las asocia de vuelta a la palabra
 * original (el servidor nunca ve esa asociación, sólo hex opacos). */
export async function searchWords(params: SearchWordsParams): Promise<SearchWordsResult[]> {
  const realLabels = params.words.map((w) => ({ word: w, label: computeTrapdoorHex(params.kIdx, w) }));
  const dummies = params.dummyCount ? generateDummyTrapdoors(params.kIdx, params.dummyCount) : [];
  const allLabels = [...realLabels.map((r) => r.label), ...dummies];

  const results = await params.api.post<LabelResultResponse[]>('/api/v1/search/batch', {
    patient_id: params.patientId,
    delegation_id: params.delegationId,
    labels_hex: allLabels,
  });

  const byLabel = new Map(results.map((r) => [r.label_hex, r] as const));
  const out: SearchWordsResult[] = [];
  for (const { word, label } of realLabels) {
    const res = byLabel.get(label);
    if (!res || !res.has_match || !res.encrypted_posting_list_base64) {
      out.push({ word, documentIds: [] });
      continue;
    }
    const list = await decryptPostingList(params.kEnc, base64ToBytes(res.encrypted_posting_list_base64));
    out.push({ word, documentIds: list.documentIds });
  }
  return out;
}

export interface ProcessPendingItemParams {
  api: ApiClient;
  patientId: string;
  identitySecretKey: Uint8Array; // SK_pac
  kIdx: Uint8Array;
  kEnc: Uint8Array;
  documentId: string;
}

/**
 * Procesa UN documento pendiente (adenda punto 16): lo descifra como
 * cualquier otro documento propio (siempre puede, vía SK_pac), tokeniza el
 * contenido en claro que ya obtuvo, indexa con trapdoors reales, calcula el
 * sobre simétrico faltante y confirma en un solo POST.
 */
export async function processPendingIndexItem(params: ProcessPendingItemParams): Promise<void> {
  const { result: decrypted, kDoc } = await fetchAndDecryptOwnDocumentWithKey(
    params.api,
    params.patientId,
    params.documentId,
    params.identitySecretKey
  );
  const keywords = await tokenizeAsync(`${decrypted.title} ${decrypted.docType} ${decrypted.content}`);

  await addDocumentToOwnIndex({
    api: params.api,
    kIdx: params.kIdx,
    kEnc: params.kEnc,
    patientId: params.patientId,
    documentId: params.documentId,
    keywords,
  });

  const symmetricEnvelope = await encryptSmall(params.kEnc, kDoc);
  kDoc.fill(0);

  await params.api.post(`/api/v1/documents/${params.documentId}/confirm-indexed`, {
    encrypted_key_envelope_symmetric_base64: bytesToBase64(symmetricEnvelope),
  });
}
