// Utilidades de codificación puras, sin estado. Reexporta lo que ya trae
// @noble/hashes (bytesToHex, hexToBytes, utf8ToBytes) para no duplicar
// implementaciones, y agrega base64 (WebCrypto no lo trae nativo).
export { bytesToHex, hexToBytes, utf8ToBytes, concatBytes, randomBytes } from '@noble/hashes/utils.js';

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // evita "Maximum call stack size exceeded" con blobs grandes
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Formatea una fecha en RFC3339 SIN fracción de segundos, exactamente como
 * `time.Time.Format(time.RFC3339)` en Go ("2006-01-02T15:04:05Z07:00" con
 * el time.Time ya en UTC produce siempre sufijo "Z", nunca milisegundos).
 *
 * Esto es crítico: el paciente firma un mensaje canónico que incluye estas
 * fechas como texto (ver delegationCrypto.ts), y el servidor reconstruye
 * el MISMO mensaje a partir del time.Time parseado para verificar la firma
 * Ed25519. Si el cliente incluyera milisegundos (como hace
 * `Date.prototype.toISOString()`) y el servidor los descarta al formatear,
 * las dos cadenas firmada/reconstruida no coincidirían byte a byte y la
 * verificación de firma fallaría siempre.
 */
export function toRFC3339NoMillis(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
