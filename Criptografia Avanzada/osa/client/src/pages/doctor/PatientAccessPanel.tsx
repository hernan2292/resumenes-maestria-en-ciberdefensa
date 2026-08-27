// Consumo de una delegación (Sección 3.1, paso "GET /api/v1/delegations/active"):
// el médico busca al paciente por su código público (nunca por email —
// adenda punto 15), pide la delegación vigente y descifra localmente
// K_idx||K_enc con su propia SK_med. Nada de esto pasa nunca en claro por
// el servidor.
import { useEffect, useState } from 'react';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { ActiveDelegationForDoctorResponse, PublicUserResponse } from '../../api/types';
import { unwrapDelegationKeys } from '../../crypto/delegationCrypto';

function minutesLeft(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
}

export default function PatientAccessPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();
  const keys = session.doctorKeys!;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);

  // Fuerza re-render cada segundo para que las cuentas regresivas avancen.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const onConsume = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setNeedsMfa(false);
    setBusy(true);
    try {
      const patient = await api.get<PublicUserResponse>(`/api/v1/users/by-code/${code.trim()}`);
      if (patient.role !== 'patient') {
        throw new ApiError(400, 'El código no corresponde a un paciente');
      }
      const active = await api.get<ActiveDelegationForDoctorResponse>(
        `/api/v1/delegations/active?patient_id=${patient.user_id}`
      );
      const unwrapped = await unwrapDelegationKeys(keys.identity.secretKey, active.encrypted_keys_for_doctor_base64);
      session.storeConsumedDelegation({
        delegationId: active.id,
        patientId: patient.user_id,
        kIdx: unwrapped.kIdx,
        kEnc: unwrapped.kEnc,
        validUntil: active.valid_until,
      });
      setMsg(`Acceso consumido: paciente ${code.trim()}, alcance "${active.scope}", vence en ${minutesLeft(active.valid_until)} min.`);
      setCode('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 428) {
        setNeedsMfa(true);
        setMsg('Tu cuenta necesita segundo factor (TOTP) activado antes de poder consumir delegaciones (adenda punto 18).');
      } else if (err instanceof ApiError && err.status === 404) {
        setMsg('Ese paciente no te otorgó acceso vigente en este momento.');
      } else {
        setMsg(err instanceof ApiError ? `Error: ${err.message}` : 'Error consumiendo la delegación');
      }
    } finally {
      setBusy(false);
    }
  };

  const activeSessions = session.listConsumedDelegations();

  return (
    <div>
      <div className="panel">
        <h2>Acceder a un paciente</h2>
        <form onSubmit={onConsume} className="inline-form">
          <label style={{ flex: 1, minWidth: 200 }}>
            Código público del paciente
            <input required placeholder="OSA-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Consultando…' : 'Consumir delegación'}
          </button>
        </form>
        {msg && <p className={msg.startsWith('Error') || needsMfa ? 'error' : 'success-note'}>{msg}</p>}
      </div>

      <div className="panel">
        <h2>Sesiones de acceso activas</h2>
        {activeSessions.length === 0 && <p className="empty-note">Todavía no consumiste ninguna delegación en esta sesión.</p>}
        <div className="entry-list">
          {activeSessions.map((s) => {
            const remaining = new Date(s.validUntil).getTime() - Date.now();
            const mins = Math.max(0, Math.round(remaining / 60000));
            return (
              <div className="entry" key={s.patientId}>
                <div className="entry-title">Paciente {s.patientId.slice(0, 8)}…</div>
                <div className="entry-meta">vence en {mins} min</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
