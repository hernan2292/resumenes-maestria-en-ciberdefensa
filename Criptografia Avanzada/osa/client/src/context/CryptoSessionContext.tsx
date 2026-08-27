// Almacén seguro y volátil de claves de sesión (Sección 6.1 / 7.2-7.3 de la
// spec; adenda punto 9). Reglas estrictas:
//   1. Ninguna clave privada ni derivada toca localStorage/sessionStorage/
//      IndexedDB — sólo variables JS en memoria del proceso de la pestaña.
//   2. Cierre de sesión automático a los 10 minutos de inactividad
//      (mousemove/keydown/visibilitychange), con zero-fill de los
//      Uint8Array antes de soltar la referencia.
//   3. Las claves de una delegación consumida por un médico se limpian
//      solas cuando el TTL expira, aunque la sesión siga activa.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { X25519KeyPair, Ed25519KeyPair } from '../crypto/keyExchange';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // Sección 7.3
const DELEGATION_EXPIRY_CHECK_INTERVAL_MS = 15 * 1000;

function zeroFill(bytes: Uint8Array | undefined) {
  if (bytes) bytes.fill(0);
}

export interface PatientKeyMaterial {
  kEnc: Uint8Array;
  kIdx: Uint8Array;
  kMask: Uint8Array;
  identity: X25519KeyPair;
  signingIdentity: Ed25519KeyPair;
}

export interface DoctorIdentityKeyMaterial {
  identity: X25519KeyPair; // para descifrar sobres de delegación futuros
}

export interface ConsumedDelegation {
  delegationId: string;
  patientId: string;
  kIdx: Uint8Array;
  kEnc: Uint8Array;
  validUntil: string; // RFC3339
}

interface SessionState {
  token: string | null;
  userId: string | null;
  role: 'patient' | 'doctor' | 'clinic_admin' | null;
  publicCode: string | null;
  patientKeys: PatientKeyMaterial | null;
  doctorKeys: DoctorIdentityKeyMaterial | null;
  consumedDelegations: Map<string, ConsumedDelegation>; // key: patientId
}

function emptyState(): SessionState {
  return {
    token: null,
    userId: null,
    role: null,
    publicCode: null,
    patientKeys: null,
    doctorKeys: null,
    consumedDelegations: new Map(),
  };
}

interface CryptoSessionContextValue {
  isUnlocked: boolean;
  token: string | null;
  userId: string | null;
  role: SessionState['role'];
  publicCode: string | null;
  patientKeys: PatientKeyMaterial | null;
  doctorKeys: DoctorIdentityKeyMaterial | null;
  getConsumedDelegation: (patientId: string) => ConsumedDelegation | undefined;
  listConsumedDelegations: () => ConsumedDelegation[];
  setPatientSession: (args: { token: string; userId: string; publicCode: string; keys: PatientKeyMaterial }) => void;
  setDoctorSession: (args: { token: string; userId: string; publicCode: string; keys: DoctorIdentityKeyMaterial }) => void;
  storeConsumedDelegation: (d: ConsumedDelegation) => void;
  clearSession: () => void;
  msUntilAutoLock: number;
}

const CryptoSessionContext = createContext<CryptoSessionContextValue | null>(null);

export function CryptoSessionProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<SessionState>(emptyState());
  const [, forceRender] = useState(0);
  const bump = () => forceRender((n) => n + 1);

  const lastActivityRef = useRef<number>(Date.now());
  const [msUntilAutoLock, setMsUntilAutoLock] = useState(INACTIVITY_TIMEOUT_MS);

  const wipeAll = useCallback(() => {
    const s = stateRef.current;
    zeroFill(s.patientKeys?.kEnc);
    zeroFill(s.patientKeys?.kIdx);
    zeroFill(s.patientKeys?.kMask);
    zeroFill(s.patientKeys?.identity.secretKey);
    zeroFill(s.patientKeys?.signingIdentity.secretKey);
    zeroFill(s.doctorKeys?.identity.secretKey);
    for (const d of s.consumedDelegations.values()) {
      zeroFill(d.kIdx);
      zeroFill(d.kEnc);
    }
    stateRef.current = emptyState();
    bump();
  }, []);

  const clearSession = useCallback(() => {
    wipeAll();
  }, [wipeAll]);

  // --- Cierre de sesión por inactividad (adenda punto 9 / Sección 7.3) ---
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, INACTIVITY_TIMEOUT_MS - idleFor);
      setMsUntilAutoLock(remaining);
      if (remaining <= 0 && stateRef.current.token !== null) {
        wipeAll();
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [wipeAll]);

  // --- Expiración de delegaciones consumidas por TTL (independiente del
  // logout general; el médico puede seguir trabajando con OTRO paciente
  // mientras el ticket de éste ya venció) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (s.consumedDelegations.size === 0) return;
      const now = Date.now();
      let changed = false;
      for (const [patientId, d] of s.consumedDelegations.entries()) {
        if (new Date(d.validUntil).getTime() <= now) {
          zeroFill(d.kIdx);
          zeroFill(d.kEnc);
          s.consumedDelegations.delete(patientId);
          changed = true;
        }
      }
      if (changed) bump();
    }, DELEGATION_EXPIRY_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const setPatientSession: CryptoSessionContextValue['setPatientSession'] = ({ token, userId, publicCode, keys }) => {
    stateRef.current = { ...emptyState(), token, userId, role: 'patient', publicCode, patientKeys: keys };
    lastActivityRef.current = Date.now();
    bump();
  };

  const setDoctorSession: CryptoSessionContextValue['setDoctorSession'] = ({ token, userId, publicCode, keys }) => {
    stateRef.current = { ...emptyState(), token, userId, role: 'doctor', publicCode, doctorKeys: keys };
    lastActivityRef.current = Date.now();
    bump();
  };

  const storeConsumedDelegation = (d: ConsumedDelegation) => {
    stateRef.current.consumedDelegations.set(d.patientId, d);
    bump();
  };

  const getConsumedDelegation = (patientId: string) => stateRef.current.consumedDelegations.get(patientId);
  const listConsumedDelegations = () => Array.from(stateRef.current.consumedDelegations.values());

  // Deliberadamente SIN useMemo: stateRef muta fuera del ciclo normal de
  // React (para poder hacer zero-fill síncrono de los Uint8Array), así que
  // el objeto `value` se reconstruye en cada render para nunca servir
  // datos obsoletos tras un bump(). Los renders son poco frecuentes
  // (login, logout, consumir una delegación, tick de inactividad cada 1s)
  // así que el costo es insignificante frente a la ganancia de correctitud.
  const value: CryptoSessionContextValue = {
    isUnlocked: stateRef.current.token !== null,
    token: stateRef.current.token,
    userId: stateRef.current.userId,
    role: stateRef.current.role,
    publicCode: stateRef.current.publicCode,
    patientKeys: stateRef.current.patientKeys,
    doctorKeys: stateRef.current.doctorKeys,
    getConsumedDelegation,
    listConsumedDelegations,
    setPatientSession,
    setDoctorSession,
    storeConsumedDelegation,
    clearSession,
    msUntilAutoLock,
  };

  return <CryptoSessionContext.Provider value={value}>{children}</CryptoSessionContext.Provider>;
}

export function useCryptoSession(): CryptoSessionContextValue {
  const ctx = useContext(CryptoSessionContext);
  if (!ctx) throw new Error('useCryptoSession debe usarse dentro de <CryptoSessionProvider>');
  return ctx;
}
