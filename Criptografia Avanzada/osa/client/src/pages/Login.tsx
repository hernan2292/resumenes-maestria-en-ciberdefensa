import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login({
        email,
        password,
        totpCode: totpCode || undefined,
        onProgress: setProgress,
      });
      navigate(result.role === 'patient' ? '/patient' : '/doctor', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 428) {
        setNeedsTotp(true);
        setError('Esta cuenta tiene segundo factor activado: ingresá el código de tu app de autenticación.');
      } else if (err instanceof ApiError && err.status === 429) {
        setError('Cuenta bloqueada temporalmente por demasiados intentos fallidos. Probá de nuevo en unos minutos.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      <h1>Iniciar sesión</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {needsTotp && (
          <label>
            Código de segundo factor (TOTP)
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
            />
          </label>
        )}
        {busy && (
          <p className="progress-note">
            Derivando claves criptográficas en tu navegador… {Math.round(progress * 100)}%
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Procesando…' : 'Ingresar'}
        </button>
      </form>
      <p>
        ¿No tenés cuenta? <Link to="/register">Registrate</Link>
      </p>
    </div>
  );
}
