import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/AuthContext';
import { ApiError } from '../api/client';

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [medicalLicense, setMedicalLicense] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicCode, setPublicCode] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await register({
        email,
        password,
        role,
        medicalLicense: role === 'doctor' ? medicalLicense : undefined,
        onProgress: setProgress,
      });
      setPublicCode(result.public_code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al registrarse');
    } finally {
      setBusy(false);
    }
  };

  if (publicCode) {
    return (
      <div className="auth-card">
        <h1>Cuenta creada</h1>
        <p>
          Guardá tu código público — lo vas a necesitar para que otros usuarios (médicos o pacientes) te
          encuentren sin exponer tu email:
        </p>
        <p className="public-code">{publicCode}</p>
        <Link to="/login">Ir a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Crear cuenta</h1>
      <form onSubmit={onSubmit}>
        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="patient">Paciente</option>
            <option value="doctor">Médico</option>
          </select>
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {role === 'doctor' && (
          <label>
            Matrícula profesional
            <input required value={medicalLicense} onChange={(e) => setMedicalLicense(e.target.value)} />
          </label>
        )}
        <label>
          Contraseña (mínimo 12 caracteres)
          <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {busy && (
          <p className="progress-note">Derivando claves criptográficas en tu navegador… {Math.round(progress * 100)}%</p>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Procesando…' : 'Registrarme'}
        </button>
      </form>
      <p>
        ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
      </p>
    </div>
  );
}
