// Orquesta registro/login: junta la derivación de claves del cliente
// (crypto/keyDerivation.ts) con el ApiClient y con CryptoSessionContext.
// La contraseña en sí NUNCA se guarda en ningún estado de React más allá
// de la variable local de la función durante el llamado — sólo vive lo que
// tarda en usarse para Argon2id (cliente) y el POST a /auth/login
// (servidor, por TLS).
import { createContext, useContext, useState, type ReactNode } from 'react';
import { ApiClient } from '../api/client';
import type { LoginResponse, RegisterResponse } from '../api/types';
import { deriveKeys, generateKDFSalt } from '../crypto/keyDerivation';
import { base64ToBytes, bytesToBase64 } from '../crypto/encoding';
import { useCryptoSession } from './CryptoSessionContext';

export type Role = 'patient' | 'doctor' | 'clinic_admin';

interface AuthContextValue {
  api: ApiClient;
  register: (args: {
    email: string;
    password: string;
    role: Role;
    medicalLicense?: string;
    onProgress?: (fraction: number) => void;
  }) => Promise<RegisterResponse>;
  login: (args: { email: string; password: string; totpCode?: string; onProgress?: (fraction: number) => void }) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useCryptoSession();
  const [token, setToken] = useState<string | null>(null);

  const api = new ApiClient({ getToken: () => token ?? session.token });

  const register: AuthContextValue['register'] = async ({ email, password, role, medicalLicense, onProgress }) => {
    const kdfSalt = generateKDFSalt();
    const keys = await deriveKeys(password, kdfSalt, onProgress);
    return api.post<RegisterResponse>('/api/v1/auth/register', {
      email,
      password,
      role,
      medical_license: medicalLicense,
      kdf_salt_base64: bytesToBase64(kdfSalt),
      public_key_base64: bytesToBase64(keys.identity.publicKey),
      signing_public_key_base64: bytesToBase64(keys.signingIdentity.publicKey),
    });
  };

  const login: AuthContextValue['login'] = async ({ email, password, totpCode, onProgress }) => {
    const result = await api.post<LoginResponse>('/api/v1/auth/login', {
      email,
      password,
      totp_code: totpCode,
    });
    setToken(result.access_token);

    const kdfSalt = base64ToBytes(result.kdf_salt_base64);
    const keys = await deriveKeys(password, kdfSalt, onProgress);

    if (result.role === 'patient') {
      session.setPatientSession({
        token: result.access_token,
        userId: result.user_id,
        publicCode: result.public_code,
        keys: {
          kEnc: keys.kEnc,
          kIdx: keys.kIdx,
          kMask: keys.kMask,
          identity: keys.identity,
          signingIdentity: keys.signingIdentity,
        },
      });
    } else {
      session.setDoctorSession({
        token: result.access_token,
        userId: result.user_id,
        publicCode: result.public_code,
        keys: { identity: keys.identity },
      });
      // Las claves de cifrado del historial (kEnc/kIdx/kMask) y la
      // identidad de firma no tienen uso para un médico sobre SU propia
      // cuenta — se descartan de inmediato (zero-fill) en vez de guardarse
      // "por si acaso": minimizar material sensible en RAM también es
      // parte de la superficie de ataque.
      keys.kEnc.fill(0);
      keys.kIdx.fill(0);
      keys.kMask.fill(0);
      keys.signingIdentity.secretKey.fill(0);
    }

    return result;
  };

  const logout = () => {
    setToken(null);
    session.clearSession();
  };

  const value: AuthContextValue = { api, register, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
