// Segundo factor (TOTP) para la cuenta del médico/clínica. A diferencia del
// paciente, acá NO es opcional en la práctica: sin TOTP activo,
// GET /api/v1/delegations/active devuelve 428 y el médico no puede consumir
// ninguna delegación (adenda puntos 4 y 18) — este panel es el paso previo
// obligatorio antes de poder usar "Acceso a pacientes".
import { useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';

export default function SecurityPanel() {
  const { api } = useAuth();

  const [otpUri, setOtpUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const onStart = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await api.post<{ otpauth_uri: string }>('/api/v1/auth/totp/setup');
      setOtpUri(res.otpauth_uri);
      setQrDataUrl(await QRCode.toDataURL(res.otpauth_uri, { margin: 1, width: 220 }));
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Error generando el secreto TOTP');
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/api/v1/auth/totp/enable', { code: totpCode });
      setEnabled(true);
      setMsg('Segundo factor activado. Ya podés consumir delegaciones de pacientes.');
      setOtpUri(null);
      setQrDataUrl(null);
      setTotpCode('');
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : 'Código inválido');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Segundo factor (TOTP) — obligatorio</h2>
      {enabled ? (
        <p className="success-note">Segundo factor activado en esta cuenta.</p>
      ) : !otpUri ? (
        <>
          <p className="warning-note">
            Tu rol requiere TOTP activo antes de poder consumir el acceso que te delegue un paciente (adenda puntos
            4 y 18). Subir documentos SÍ funciona sin esto — la restricción sólo aplica a leer/buscar historiales.
          </p>
          <button type="button" disabled={busy} onClick={onStart}>
            Activar 2FA
          </button>
        </>
      ) : (
        <form onSubmit={onConfirm}>
          {qrDataUrl && <img src={qrDataUrl} alt="Código QR para configurar TOTP" style={{ display: 'block', margin: '12px 0' }} />}
          <p className="empty-note">
            Escaneá el QR con tu app de autenticación (Google Authenticator, Authy, etc.) o ingresá manualmente:
          </p>
          <code style={{ display: 'block', marginBottom: 12, wordBreak: 'break-all' }}>{otpUri}</code>
          <label>
            Código de 6 dígitos para confirmar
            <input inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Verificando…' : 'Confirmar y activar'}
          </button>
        </form>
      )}
      {msg && <p className={msg.includes('inválido') || msg.startsWith('Error') ? 'error' : 'success-note'}>{msg}</p>}
    </div>
  );
}
