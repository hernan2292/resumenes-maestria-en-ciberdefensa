// Guardia de rutas: exige sesión desbloqueada (claves en RAM, ver
// CryptoSessionContext) y, opcionalmente, un rol específico. No hay
// concepto de "sesión persistida" que restaurar al recargar la página: si
// el navegador se recarga, las claves (que nunca tocan localStorage por
// diseño) desaparecen y hay que loguearse de nuevo — es la contraparte
// esperada de guardar todo sólo en RAM (adenda punto 9).
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCryptoSession } from '../context/CryptoSessionContext';

export default function ProtectedRoute({
  role,
  children,
}: {
  role: string | string[];
  children: ReactNode;
}) {
  const session = useCryptoSession();

  if (!session.isUnlocked) {
    return <Navigate to="/login" replace />;
  }

  const allowed = Array.isArray(role) ? role : [role];
  if (!session.role || !allowed.includes(session.role)) {
    return <Navigate to={session.role === 'patient' ? '/patient' : '/doctor'} replace />;
  }

  return <>{children}</>;
}
