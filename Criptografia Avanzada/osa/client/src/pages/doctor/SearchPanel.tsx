// Búsqueda SSE-2 sobre el historial de un paciente delegado. Usa las
// K_idx/K_enc que ya se descifraron localmente al consumir la delegación
// (PatientAccessPanel) — nunca se vuelven a pedir al servidor.
import { useState } from 'react';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { searchWords, type SearchWordsResult } from '../../services/indexing';
import { fetchAndDecryptDocumentAsDoctor, type DecryptedDocument } from '../../services/documentCrypto';

export default function SearchPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();
  const sessions = session.listConsumedDelegations();

  const [patientId, setPatientId] = useState(sessions[0]?.patientId ?? '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchWordsResult[]>([]);
  const [opened, setOpened] = useState<Record<string, DecryptedDocument | 'loading' | 'error'>>({});

  const active = sessions.find((s) => s.patientId === patientId);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const words = query
        .split(/[\s,]+/)
        .map((w) => w.trim())
        .filter(Boolean);
      const out = await searchWords({
        api,
        kIdx: active.kIdx,
        kEnc: active.kEnc,
        patientId: active.patientId,
        delegationId: active.delegationId,
        words,
        dummyCount: 3,
      });
      setResults(out);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al buscar');
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (documentId: string) => {
    if (!active) return;
    if (opened[documentId] && opened[documentId] !== 'error') {
      setOpened((prev) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
      return;
    }
    setOpened((prev) => ({ ...prev, [documentId]: 'loading' }));
    try {
      const decrypted = await fetchAndDecryptDocumentAsDoctor(api, active.patientId, documentId, active.delegationId, active.kEnc);
      setOpened((prev) => ({ ...prev, [documentId]: decrypted }));
    } catch (err) {
      setOpened((prev) => ({ ...prev, [documentId]: 'error' }));
      setError(err instanceof Error ? err.message : 'No se pudo descifrar el documento');
    }
  };

  const allDocumentIds = Array.from(new Set(results.flatMap((r) => r.documentIds)));

  if (sessions.length === 0) {
    return (
      <div className="panel">
        <p className="empty-note">Primero consumí una delegación activa en la pestaña "Acceso a pacientes".</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Buscar en el historial delegado</h2>
      <form onSubmit={onSearch} className="inline-form">
        <label>
          Paciente
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.patientId} value={s.patientId}>
                {s.patientId.slice(0, 8)}…
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1, minWidth: 200 }}>
          Palabras clave
          <input placeholder="ej: glucosa, resonancia" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {results.map((r) => (
            <p key={r.word} className="entry-meta">
              <strong>{r.word}</strong>: {r.documentIds.length} documento(s)
            </p>
          ))}
          <div className="entry-list" style={{ marginTop: 10 }}>
            {allDocumentIds.map((docId) => (
              <div className="entry" key={docId}>
                <div className="entry-header">
                  <span className="entry-meta">{docId}</span>
                  <button type="button" className="secondary" onClick={() => onOpen(docId)}>
                    {opened[docId] ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                {opened[docId] === 'loading' && <p className="progress-note">Descifrando…</p>}
                {opened[docId] === 'error' && <p className="error">No se pudo descifrar (¿todavía no fue indexado por el paciente?).</p>}
                {opened[docId] && opened[docId] !== 'loading' && opened[docId] !== 'error' && (
                  <div className="entry-content">
                    <strong>{(opened[docId] as DecryptedDocument).title}</strong>
                    <br />
                    {(opened[docId] as DecryptedDocument).content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
