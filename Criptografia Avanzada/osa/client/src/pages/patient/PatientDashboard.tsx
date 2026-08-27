import { useState } from 'react';
import DocumentsPanel from './DocumentsPanel';
import SearchPanel from './SearchPanel';
import DelegationsPanel from './DelegationsPanel';
import SecurityPanel from './SecurityPanel';

type Tab = 'documents' | 'search' | 'delegations' | 'security';

const tabs: { id: Tab; label: string }[] = [
  { id: 'documents', label: 'Documentos' },
  { id: 'search', label: 'Buscar' },
  { id: 'delegations', label: 'Delegaciones' },
  { id: 'security', label: 'Seguridad' },
];

export default function PatientDashboard() {
  const [tab, setTab] = useState<Tab>('documents');

  return (
    <div>
      <h1>Mi historial clínico</h1>
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)} type="button">
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'documents' && <DocumentsPanel />}
      {tab === 'search' && <SearchPanel />}
      {tab === 'delegations' && <DelegationsPanel />}
      {tab === 'security' && <SecurityPanel />}
    </div>
  );
}
