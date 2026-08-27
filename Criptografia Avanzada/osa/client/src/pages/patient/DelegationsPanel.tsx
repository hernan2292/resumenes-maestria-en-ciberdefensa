// Panel de control de privacidad del paciente (Sección 6.1.A): otorgar
// acceso temporal a un médico por su código público (nunca por email —
// adenda punto 15), ver quién tiene acceso vigente y revocar en 1 click
// ("botón de pánico").
import { useCallback, useEffect, useState } from 'react';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { DelegationResponse, PublicUserResponse } from '../../api/types';
import { base64ToBytes } from '../../crypto/encoding';
import { computeScopeLabelHex } from '../../crypto/sseCore';
import { createDelegationTicket } from '../../crypto/delegationCrypto';

function msUntil(iso: string): number {
  return new Date(iso).getTime() - Date.now();
}

export default function DelegationsPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();
  const keys = session.patientKeys!;

  const [delegations, setDelegations] = useState<DelegationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [doctorCode, setDoctorCode] = useState('');
  const [scope, setScope] = useState('all');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Fuerza un re-render cada segundo para que las barras de TTL avancen.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.get<DelegationResponse[]>('/api/v1/delegations/mine');
      setDelegations(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando delegaciones');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg(null);
    setBusy(true);
    try {
      const doctor = await api.get<PublicUserResponse>(`/api/v1/users/by-code/${doctorCode.trim()}`);
      if (doctor.role !== 'doctor' && doctor.role !== 'clinic_admin') {
        throw new Error('El código no corresponde a una cuenta de médico/clínica');
      }
      const scopeLabelHex = scope === 'all' ? undefined : computeScopeLabelHex(keys.kIdx, scope);
      const draft = await createDelegationTicket({
        patientId: session.userId!,
        doctorId: doctor.user_id,
        doctorPublicKey: base64ToBytes(doctor.public_key_base64),
        patientSigningSecretKey: keys.signingIdentity.secretKey,
        kIdx: keys.kIdx,
        kEnc: keys.kEnc,
        scope,
        scopeLabelHex,
        durationMinutes,
      });
      await api.post('/api/v1/delegations', {
        doctor_id: draft.doctorId,
        scope: draft.scope,
        scope_label_hex: draft.scopeLabelHex,
        encrypted_keys_for_doctor_base64: draft.encryptedKeysForDoctorB64,
        valid_from: draft.validFrom,
        valid_until: draft.validUntil,
        patient_signature_hex: draft.patientSignatureHex,
      });
      setCreateMsg(`Acceso otorgado a ${doctorCode.trim()} por ${durationMinutes} minutos.`);
      setDoctorCode('');
      await refresh();
    } catch (err) {
      setCreateMsg(err instanceof ApiError || err instanceof Error ? `Error: ${err.message}` : 'Error creando la delegación');
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.post(`/api/v1/delegations/${id}/revoke`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al revocar');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Otorgar acceso temporal</h2>
        <form onSubmit={onCreate}>
          <div className="panel-row">
            <label>
              Código público del médico
              <input required placeholder="OSA-XXXX-XXXX" value={doctorCode} onChange={(e) => setDoctorCode(e.target.value)} />
            </label>
            <label>
              Alcance
              <input placeholder='"all" o una categoría, ej: cardiología' value={scope} onChange={(e) => setScope(e.target.value)} />
            </label>
            <label>
              Duración (minutos, máx 120)
              <input
                type="number"
                min={1}
                max={120}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </label>
          </div>
          {createMsg && <p className={createMsg.startsWith('Error') ? 'error' : 'success-note'}>{createMsg}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Firmando y enviando…' : 'Otorgar acceso'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Accesos vigentes</h2>
        {loading && <p className="empty-note">Cargando…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && delegations.length === 0 && <p className="empty-note">Ningún médico tiene acceso vigente ahora mismo.</p>}
        <div className="entry-list">
          {delegations.map((d) => {
            const remaining = msUntil(d.valid_until);
            const total = new Date(d.valid_until).getTime() - new Date(d.valid_from).getTime();
            const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
            const minutesLeft = Math.max(0, Math.round(remaining / 60000));
            return (
              <div className="entry" key={d.id}>
                <div className="entry-header">
                  <div>
                    <div className="entry-title">Médico {d.doctor_id.slice(0, 8)}…</div>
                    <div className="entry-meta">
                      Alcance: {d.scope} · vence en {minutesLeft} min
                    </div>
                  </div>
                  <button type="button" className="danger" disabled={revokingId === d.id} onClick={() => onRevoke(d.id)}>
                    {revokingId === d.id ? 'Revocando…' : 'Revocar ahora'}
                  </button>
                </div>
                <div className="ttl-bar-track">
                  <div className="ttl-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
