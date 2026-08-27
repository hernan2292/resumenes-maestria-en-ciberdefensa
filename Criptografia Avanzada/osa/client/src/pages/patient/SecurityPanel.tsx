// Seguridad de la cuenta: segundo factor TOTP (opcional para paciente,
// obligatorio por política para médico/clínica — ver adenda puntos 4/18) y
// rotación soberana de la clave maestra (Sección 4.2 / adenda punto 19).
import { useState } from 'react';
import QRCode from 'qrcode';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { performRekey } from '../../services/rekey';

export default function SecurityPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();
  const keys = session.patientKeys!;

  const [otpUri, setOtpUri] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpMsg, setTotpMsg] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  const onStartTotpSetup = async () => {
    setTotpMsg(null);
    setTotpBusy(true);
    try {
      const res = await api.post<{ otpauth_uri: string }>('/api/v1/auth/totp/setup');
      setOtpUri(res.otpauth_uri);
      setQrDataUrl(await QRCode.toDataURL(res.otpauth_uri, { margin: 1, width: 220 }));
    } catch (err) {
      setTotpMsg(err instanceof ApiError ? err.message : 'Error generando el secreto TOTP');
    } finally {
      setTotpBusy(false);
    }
  };

  const onConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpBusy(true);
    setTotpMsg(null);
    try {
      await api.post('/api/v1/auth/totp/enable', { code: totpCode });
      setTotpEnabled(true);
      setTotpMsg('Segundo factor activado.');
      setOtpUri(null);
      setQrDataUrl(null);
      setTotpCode('');
    } catch (err) {
      setTotpMsg(err instanceof ApiError ? err.message : 'Código inválido');
    } finally {
      setTotpBusy(false);
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rekeyBusy, setRekeyBusy] = useState(false);
  const [rekeyProgress, setRekeyProgress] = useState<{ fraction: number; label: string } | null>(null);
  const [rekeyMsg, setRekeyMsg] = useState<string | null>(null);

  const onRekey = async (e: React.FormEvent) => {
    e.preventDefault();
    setRekeyMsg(null);
    if (newPassword.length < 12) {
      setRekeyMsg('Error: la contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRekeyMsg('Error: las contraseñas no coinciden.');
      return;
    }
    setRekeyBusy(true);
    try {
      const outcome = await performRekey({
        api,
        patientId: session.userId!,
        newPassword,
        oldIdentitySecretKey: keys.identity.secretKey,
        onProgress: (fraction, label) => setRekeyProgress({ fraction, label }),
      });

      // Swap las claves viejas por las nuevas en la sesión en RAM, con
      // zero-fill explícito de las viejas (adenda punto 9) — nunca queda
      // material de la identidad revocada vivo en memoria más de lo
      // necesario.
      keys.kEnc.fill(0);
      keys.kIdx.fill(0);
      keys.kMask.fill(0);
      keys.identity.secretKey.fill(0);
      keys.signingIdentity.secretKey.fill(0);
      session.setPatientSession({
        token: session.token!,
        userId: session.userId!,
        publicCode: session.publicCode!,
        keys: outcome.newKeys,
      });

      setNewPassword('');
      setConfirmPassword('');
      setRekeyMsg(
        `Rotación completa: se re-envolvieron ${outcome.documentsRewrapped} documento(s), se revocaron todas las delegaciones activas y tu contraseña quedó actualizada. La próxima vez que inicies sesión, usá la contraseña nueva.`
      );
    } catch (err) {
      setRekeyMsg(err instanceof ApiError ? `Error: ${err.message}` : 'Error durante la rotación de clave');
    } finally {
      setRekeyBusy(false);
      setRekeyProgress(null);
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Segundo factor (TOTP)</h2>
        {totpEnabled ? (
          <p className="success-note">Segundo factor activado en esta cuenta.</p>
        ) : !otpUri ? (
          <>
            <p className="empty-note">
              Opcional para pacientes; obligatorio para cuentas de médico/clínica antes de poder consumir una
              delegación (adenda puntos 4 y 18).
            </p>
            <button type="button" disabled={totpBusy} onClick={onStartTotpSetup}>
              Activar 2FA
            </button>
          </>
        ) : (
          <form onSubmit={onConfirmTotp}>
            {qrDataUrl && <img src={qrDataUrl} alt="Código QR para configurar TOTP" style={{ display: 'block', margin: '12px 0' }} />}
            <p className="empty-note">
              Escaneá el QR con tu app de autenticación (Google Authenticator, Authy, etc.) o ingresá manualmente:
            </p>
            <code style={{ display: 'block', marginBottom: 12, wordBreak: 'break-all' }}>{otpUri}</code>
            <label>
              Código de 6 dígitos para confirmar
              <input inputMode="numeric" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
            </label>
            <button type="submit" disabled={totpBusy}>
              {totpBusy ? 'Verificando…' : 'Confirmar y activar'}
            </button>
          </form>
        )}
        {totpMsg && <p className={totpMsg.startsWith('Error') || totpMsg.includes('inválido') ? 'error' : 'success-note'}>{totpMsg}</p>}
      </div>

      <div className="panel">
        <h2>Rotación de clave maestra</h2>
        <p className="warning-note">
          Usá esto sólo si sospechás que tu contraseña o un dispositivo estuvo comprometido. Genera una identidad
          criptográfica completamente nueva, revoca TODAS las delegaciones activas y re-envuelve tu historial
          entero para la clave nueva — puede tardar si tenés muchos documentos, y no se puede interrumpir a mitad
          de camino sin perder la operación completa (aunque nunca deja documentos a medio migrar: es todo o nada).
        </p>
        <form onSubmit={onRekey}>
          <div className="panel-row">
            <label>
              Contraseña nueva (mínimo 12 caracteres)
              <input type="password" minLength={12} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label>
              Confirmar contraseña nueva
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          </div>
          {rekeyProgress && (
            <p className="progress-note">
              {rekeyProgress.label} ({Math.round(rekeyProgress.fraction * 100)}%)
            </p>
          )}
          {rekeyMsg && <p className={rekeyMsg.startsWith('Error') ? 'error' : 'success-note'}>{rekeyMsg}</p>}
          <button type="submit" className="danger" disabled={rekeyBusy}>
            {rekeyBusy ? 'Rotando…' : 'Rotar clave maestra'}
          </button>
        </form>
      </div>
    </div>
  );
}
