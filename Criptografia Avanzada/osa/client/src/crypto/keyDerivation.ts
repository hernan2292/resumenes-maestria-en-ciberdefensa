// Derivación de claves del lado del cliente (Sección 2 de la spec).
//
// IMPORTANTE (adenda punto 13 — separación de dominios): esta es la ÚNICA
// contraseña que el usuario escribe, pero se usa en dos derivaciones
// criptográficamente independientes:
//   1) Argon2id aquí, con `kdf_salt` (nunca sale del navegador salvo como
//      metadata pública) -> semilla maestra -> K_enc / K_idx / K_mask /
//      identidad X25519+Ed25519. El servidor JAMÁS ve esta semilla ni las
//      claves derivadas de ella.
//   2) La contraseña en texto plano viaja UNA vez por TLS en /auth/login
//      y /auth/register; el SERVIDOR la hashea con su propio Argon2id y
//      su propio salt aleatorio (independiente de kdf_salt) sólo para
//      autenticar la sesión HTTP (ver server/internal/crypto/password.go).
// Comprometer el hash de autenticación del servidor no debe dar ninguna
// ventaja para atacar K_enc/K_idx, y viceversa.
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes, utf8ToBytes } from './encoding';
import { x25519KeygenFromSeed, ed25519KeygenFromSeed, type X25519KeyPair, type Ed25519KeyPair } from './keyExchange';

// Mismos parámetros documentados en la Sección 2.1 de la spec. En JS puro
// (sin WASM) esto puede tardar unos segundos — se expone onProgress para
// que la UI muestre una barra de progreso en vez de parecer colgada.
export const ARGON2ID_PARAMS = { t: 3, m: 64 * 1024, p: 4, dkLen: 32 } as const;

export function generateKDFSalt(): Uint8Array {
  return randomBytes(32); // 256 bits, como pide la Sección 2.1
}

export interface DerivedKeys {
  masterSeed: Uint8Array;
  identity: X25519KeyPair;
  signingIdentity: Ed25519KeyPair;
  kEnc: Uint8Array;
  kIdx: Uint8Array;
  kMask: Uint8Array;
}

export async function deriveKeys(
  password: string,
  kdfSalt: Uint8Array,
  onProgress?: (fraction: number) => void
): Promise<DerivedKeys> {
  const masterSeed = await argon2idAsync(password, kdfSalt, {
    ...ARGON2ID_PARAMS,
    asyncTick: 10,
    onProgress,
  });

  // Domain separation vía HKDF-SHA256 con "info" distinto por subclave:
  // ningún atacante que recupere una subclave puede derivar las demás.
  const identitySeed = hkdf(sha256, masterSeed, undefined, utf8ToBytes('osa/identity-x25519'), 32);
  const signingSeed = hkdf(sha256, masterSeed, undefined, utf8ToBytes('osa/identity-ed25519'), 32);
  const kEnc = hkdf(sha256, masterSeed, undefined, utf8ToBytes('osa/k-enc'), 32);
  const kIdx = hkdf(sha256, masterSeed, undefined, utf8ToBytes('osa/k-idx'), 32);
  const kMask = hkdf(sha256, masterSeed, undefined, utf8ToBytes('osa/k-mask'), 32);

  return {
    masterSeed,
    identity: x25519KeygenFromSeed(identitySeed),
    signingIdentity: ed25519KeygenFromSeed(signingSeed),
    kEnc,
    kIdx,
    kMask,
  };
}
