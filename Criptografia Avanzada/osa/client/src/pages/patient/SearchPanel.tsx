// Búsqueda SSE-2 sobre el propio historial, con trapdoors señuelo
// opcionales (adenda punto 8) para que el servidor no pueda contar cuántos
// términos reales se buscaron.
import { useState } from 'react';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { searchWords, type SearchWordsResult } from '../../services/indexing';
import { fetchAndDecryptOwnDocument, type DecryptedDocument } from '../../services/documentCrypto';

export default function SearchPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();
  const keys = session.patientKeys!;

  const [query, setQuery] = useState('');
  const [useDummies, setUseDummies] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchWordsResult[]>([]);
  const [opened, setOpened] = useState<Record<string, DecryptedDocument | 'loading' | 'error'>>({});

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const words = query
        .split(/[\s,]+/)
        .map((w) => w.trim())
        .filter(Boolean);
      const out = await searchWords({
        api,
        kIdx: keys.kIdx,
        kEnc: keys.kEnc,
        patientId: session.userId!,
        words,
        dummyCount: useDummies ? 3 : 0,
      });
      setResults(out);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al buscar');
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (documentId: string) => {
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
      const decrypted = await fetchAndDecryptOwnDocument(api, session.userId!, documentId, keys.identity.secretKey);
      setOpened((prev) => ({ ...prev, [documentId]: decrypted }));
    } catch {
      setOpened((prev) => ({ ...prev, [documentId]: 'error' }));
    }
  };

  const allDocumentIds = Array.from(new Set(results.flatMap((r) => r.documentIds)));

  return (
    <div className="panel">
      <h2>Buscar en tu historial</h2>
      <form onSubmit={onSearch} className="inline-form">
        <label style={{ flex: 1, minWidth: 220 }}>
          Palabras clave
          <input placeholder="ej: glucosa, resonancia" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 'auto' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={useDummies} onChange={(e) => setUseDummies(e.target.checked)} />
          Ocultar cantidad real de términos (señuelos)
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
                {opened[docId] === 'error' && <p className="error">No se pudo descifrar.</p>}
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
