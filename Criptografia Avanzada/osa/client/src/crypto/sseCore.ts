// Núcleo del motor de Búsqueda Simétrica Cifrada (SSE-2 / CGKO), Sección
// 2.1 y 5.1 de la spec: PRF de trapdoors, etiquetas de alcance opacas
// (adenda punto 2), tokenización y manejo de la posting list cifrada.
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes, concatBytes } from './encoding';
import { encryptSmall, decryptSmall } from './aesGcm';

/** L_w = HMAC-SHA256(K_idx, w || 0x01) — el "1" final separa el espacio de
 * trapdoors de palabra del espacio de scope labels (que usan 0x02), para
 * que ningún trapdoor de búsqueda pueda colisionar con una scope label. */
export function computeTrapdoor(kIdx: Uint8Array, word: string): Uint8Array {
  const normalized = normalizeWord(word);
  return hmac(sha256, kIdx, concatBytes(utf8ToBytes(normalized), new Uint8Array([0x01])));
}

export function computeTrapdoorHex(kIdx: Uint8Array, word: string): string {
  return bytesToHex(computeTrapdoor(kIdx, word));
}

/** Scope label opaca (adenda punto 2): HMAC-SHA256(K_idx, "SCOPE#cat" || 0x02). */
export function computeScopeLabel(kIdx: Uint8Array, category: string): Uint8Array {
  return hmac(sha256, kIdx, concatBytes(utf8ToBytes(`SCOPE#${category.toLowerCase()}`), new Uint8Array([0x02])));
}

export function computeScopeLabelHex(kIdx: Uint8Array, category: string): string {
  return bytesToHex(computeScopeLabel(kIdx, category));
}

/**
 * Tokenización simple para términos clínicos: minúsculas, sin acentos, se
 * descartan tokens de 1 carácter. No es un tokenizador médico real (eso
 * requeriría un vocabulario UMLS/SNOMED); es intencionalmente básico para
 * este MVP y corre en un Web Worker (ver workers/textIndexer.worker.ts)
 * para no bloquear la UI con documentos grandes.
 */
export function tokenize(text: string): string[] {
  const normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .toLowerCase();
  const words = normalized.match(/[a-z0-9]+/g) ?? [];
  const unique = new Set(words.filter((w) => w.length >= 2));
  return Array.from(unique);
}

export interface PostingList {
  documentIds: string[];
}

export async function encryptPostingList(kEnc: Uint8Array, list: PostingList): Promise<Uint8Array> {
  const plaintext = utf8ToBytes(JSON.stringify(list));
  return encryptSmall(kEnc, plaintext);
}

export async function decryptPostingList(kEnc: Uint8Array, ciphertext: Uint8Array): Promise<PostingList> {
  const plaintext = await decryptSmall(kEnc, ciphertext);
  const parsed = JSON.parse(new TextDecoder().decode(plaintext));
  if (!parsed || !Array.isArray(parsed.documentIds)) {
    throw new Error('posting list corrupta o formato inesperado');
  }
  return parsed as PostingList;
}

export function mergePostingLists(a: PostingList, b: PostingList): PostingList {
  return { documentIds: Array.from(new Set([...a.documentIds, ...b.documentIds])) };
}

function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Genera N trapdoors señuelo (palabras aleatorias inexistentes) para
 * mezclar con los trapdoors reales en un lote de búsqueda, ocultando el
 * número real de términos consultados (Sección 7.4 / adenda punto 8). El
 * servidor no puede distinguirlos: son HMACs igual de opacos.
 */
export function generateDummyTrapdoors(kIdx: Uint8Array, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomWord = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    out.push(computeTrapdoorHex(kIdx, `__dummy__${randomWord}`));
  }
  return out;
}
