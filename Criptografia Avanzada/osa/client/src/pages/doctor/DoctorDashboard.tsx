import { useState } from 'react';
import PatientAccessPanel from './PatientAccessPanel';
import SearchPanel from './SearchPanel';
import DocumentsPanel from './DocumentsPanel';
import SecurityPanel from './SecurityPanel';

type Tab = 'access' | 'search' | 'documents' | 'security';

const tabs: { id: Tab; label: string }[] = [
  { id: 'access', label: 'Acceso a pacientes' },
  { id: 'search', label: 'Buscar' },
  { id: 'documents', label: 'Subir documento' },
  { id: 'security', label: 'Seguridad' },
];

export default function DoctorDashboard() {
  const [tab, setTab] = useState<Tab>('access');

  return (
    <div>
      <h1>Portal médico</h1>
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'access' && <PatientAccessPanel />}
      {tab === 'search' && <SearchPanel />}
      {tab === 'documents' && <DocumentsPanel />}
      {tab === 'security' && <SecurityPanel />}
    </div>
  );
}
