// Cifrado y descifrado autenticado de archivos (AES-256-GCM) con padding
// anti-inferencia de tamaño (Sección 7.4 de la spec; adenda punto 8).
//
// Usamos SubtleCrypto nativo para AES-GCM (soportado de forma consistente
// en todos los navegadores modernos y con mejor rendimiento que una
// implementación JS), pero X25519/Ed25519 vía @noble/curves porque
// WebCrypto no soporta esas curvas de forma consistente (adenda punto 10).

const BLOCK_SIZE = 64 * 1024; // 64 KiB, igual que en el servidor (document_service.go)
const IV_LENGTH = 12; // 96 bits, únicos por documento
const GCM_TAG_LENGTH = 16; // 128 bits, fijo — es lo que WebCrypto agrega al final del ciphertext
// AES-GCM antepone el IV y agrega el tag de autenticación al blob que
// efectivamente viaja al servidor; ambos son overhead FIJO (no depende del
// contenido) pero rompen la propiedad "múltiplo de 64KiB" si el padding se
// calcula sólo sobre el plaintext (ver bug corregido más abajo, encontrado
// por integration-test/run.ts: todo upload de documento fallaba 400 contra
// el servidor real porque encryptDocumentBlob nunca producía un tamaño
// final múltiplo de 65536). Como es un desplazamiento constante y público
// (todo el mundo sabe que un blob de OSA lleva 12+16 bytes de framing), no
// reintroduce ninguna fuga de información que el padding no tuviera ya.
const AEAD_FRAME_OVERHEAD = IV_LENGTH + GCM_TAG_LENGTH; // 28

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== 32) {
    throw new Error('la clave AES-256-GCM debe tener 32 bytes');
  }
  return crypto.subtle.importKey('raw', rawKey as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/**
 * Aplica padding estilo ISO/IEC 7816-4 (0x80 seguido de ceros) hasta que
 * `data.length` caiga en el residuo `targetResidue` módulo `blockSize` —
 * por defecto (`targetResidue = 0`) eso es simplemente "el próximo múltiplo
 * de `blockSize`". `encryptDocumentBlob` usa un residuo distinto de cero
 * para compensar el overhead fijo de IV+tag que se agrega DESPUÉS de
 * cifrar, de forma que el blob final (no sólo el plaintext) sea el que
 * termine siendo múltiplo exacto de 64KiB, que es lo que valida el
 * servidor. Siempre se agrega al menos 1 byte de padding (el marcador
 * 0x80), incluso cuando `data` ya cae en el residuo buscado, para que
 * `unpad` nunca sea ambiguo.
 */
export function padToBlock(data: Uint8Array, blockSize: number = BLOCK_SIZE, targetResidue: number = 0): Uint8Array {
  const minLen = data.length + 1; // al menos 1 byte para el marcador 0x80
  const currentResidue = minLen % blockSize;
  const extra = (targetResidue - currentResidue + blockSize) % blockSize;
  const paddedLen = minLen + extra;
  const out = new Uint8Array(paddedLen);
  out.set(data, 0);
  out[data.length] = 0x80;
  return out;
}

export function unpad(padded: Uint8Array): Uint8Array {
  let i = padded.length - 1;
  while (i >= 0 && padded[i] === 0x00) i--;
  if (i < 0 || padded[i] !== 0x80) {
    throw new Error('padding inválido: no se encontró el marcador 0x80');
  }
  return padded.slice(0, i);
}

/**
 * Cifra `plaintext` con padding a bloques de 64KiB aplicado ANTES de
 * cifrar (el servidor rechaza blobs cuyo tamaño cifrado no sea múltiplo de
 * 64KiB, ver document_service.go). El padding se calcula con el residuo
 * desplazado por `AEAD_FRAME_OVERHEAD` para que sea el paquete FINAL
 * (IV||ciphertext||tag, lo que efectivamente se sube) el que caiga en un
 * múltiplo exacto de 64KiB — no el plaintext paddeado por sí solo, que
 * quedaría 28 bytes corto. Retorna IV||ciphertext||tag listo para enviar en
 * `encrypted_blob_base64`.
 */
export async function encryptDocumentBlob(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const targetResidue = (BLOCK_SIZE - AEAD_FRAME_OVERHEAD) % BLOCK_SIZE;
  const padded = padToBlock(plaintext, BLOCK_SIZE, targetResidue);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await importAesKey(key);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, padded as BufferSource)
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return combined;
}

export async function decryptDocumentBlob(key: Uint8Array, combined: Uint8Array): Promise<Uint8Array> {
  if (combined.length < IV_LENGTH) {
    throw new Error('blob cifrado demasiado corto');
  }
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const cryptoKey = await importAesKey(key);
  const paddedPlaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, ciphertext as BufferSource)
  );
  return unpad(paddedPlaintext);
}

/**
 * Variante SIN padding, para blobs pequeños que no son documentos clínicos
 * en sí (p. ej. una posting list del índice SSE-2, o un sobre de claves):
 * su tamaño ya es indistinguible entre pacientes/documentos porque son
 * listas de UUIDs / material de clave de longitud fija o casi fija, así
 * que el padding de 64KiB sería puro desperdicio de ancho de banda ahí.
 */
export async function encryptSmall(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await importAesKey(key);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, plaintext as BufferSource)
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return combined;
}

export async function decryptSmall(key: Uint8Array, combined: Uint8Array): Promise<Uint8Array> {
  if (combined.length < IV_LENGTH) {
    throw new Error('blob cifrado demasiado corto');
  }
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const cryptoKey = await importAesKey(key);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, cryptoKey, ciphertext as BufferSource)
  );
}
