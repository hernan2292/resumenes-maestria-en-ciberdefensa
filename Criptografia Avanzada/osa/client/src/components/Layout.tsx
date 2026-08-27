// Shell visible en todo el portal autenticado: marca, rol/código público,
// contador de cierre de sesión por inactividad (adenda punto 9) y logout.
import { Outlet, Link } from 'react-router-dom';
import { useCryptoSession } from '../context/CryptoSessionContext';
import { useAuth } from '../context/AuthContext';

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const roleLabel: Record<string, string> = {
  patient: 'Paciente',
  doctor: 'Médico',
  clinic_admin: 'Clínica',
};

export default function Layout() {
  const session = useCryptoSession();
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to={session.role === 'patient' ? '/patient' : '/doctor'} className="brand">
          OSA
        </Link>
        {session.isUnlocked && (
          <div className="header-session">
            <span className="badge">{session.role ? roleLabel[session.role] : ''}</span>
            <span className="public-code-chip">{session.publicCode}</span>
            <span
              className="lock-timer"
              title="Tiempo hasta el cierre de sesión automático por inactividad (adenda punto 9)"
            >
              🔒 {formatMs(session.msUntilAutoLock)}
            </span>
            <button type="button" className="secondary" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
