// Intercambio de claves X25519 y firmas Ed25519 (adenda punto 10: se usa
// @noble/curves en vez de WebCrypto P-256 para ser consistentes con la
// primitiva declarada en la Sección 2 de la spec, y con el servidor Go que
// usa crypto/ecdh (X25519) y crypto/ed25519 nativos de la librería
// estándar).
import { x25519, ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, randomBytes, utf8ToBytes } from './encoding';
import { encryptSmall, decryptSmall } from './aesGcm';

export interface X25519KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface Ed25519KeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function x25519KeygenFromSeed(seed: Uint8Array): X25519KeyPair {
  return x25519.keygen(seed);
}

export function ed25519KeygenFromSeed(seed: Uint8Array): Ed25519KeyPair {
  return ed25519.keygen(seed);
}

export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, secretKey);
}

export function verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  return ed25519.verify(signature, message, publicKey);
}

/**
 * ECIES simplificado sobre X25519: genera un par efímero, deriva una clave
 * AES-256-GCM vía ECDH+HKDF-SHA256, y cifra `plaintext` para el dueño de
 * `recipientPublicKey`. El resultado es
 * `ephemeralPublicKey(32) || AES-GCM(iv(12) || ciphertext || tag)`,
 * autodescriptivo: quien tiene la SK correspondiente puede descifrarlo sin
 * más contexto. Se usa tanto para el sobre de K_doc (Sección 4.1) como
 * para el sobre de K_idx||K_enc de una delegación (Sección 3.1) y para la
 * cola de indexación diferida (adenda punto 16).
 */
export async function eciesEncrypt(recipientPublicKey: Uint8Array, plaintext: Uint8Array, infoTag: string): Promise<Uint8Array> {
  const ephemeral = x25519KeygenFromSeed(randomBytes(32));
  const shared = x25519.getSharedSecret(ephemeral.secretKey, recipientPublicKey);
  const aesKey = hkdf(sha256, shared, undefined, utf8ToBytes(`osa/ecies/${infoTag}`), 32);
  const ciphertext = await encryptSmall(aesKey, plaintext);
  return concatBytes(ephemeral.publicKey, ciphertext);
}

export async function eciesDecrypt(recipientSecretKey: Uint8Array, envelope: Uint8Array, infoTag: string): Promise<Uint8Array> {
  if (envelope.length < 32) {
    throw new Error('sobre ECIES demasiado corto');
  }
  const ephemeralPublicKey = envelope.slice(0, 32);
  const ciphertext = envelope.slice(32);
  const shared = x25519.getSharedSecret(recipientSecretKey, ephemeralPublicKey);
  const aesKey = hkdf(sha256, shared, undefined, utf8ToBytes(`osa/ecies/${infoTag}`), 32);
  return decryptSmall(aesKey, ciphertext);
}
