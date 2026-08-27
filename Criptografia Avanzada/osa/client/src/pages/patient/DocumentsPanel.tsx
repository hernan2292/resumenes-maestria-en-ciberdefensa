// Historial del paciente: listado (con título/tipo descifrados en el
// cliente), subida de documentos propios, visor bajo demanda y cola de
// "por indexar" (adenda punto 16) para documentos que un tercero subió sin
// tener K_idx en ese momento.
import { useCallback, useEffect, useState } from 'react';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import type { DocumentResponse, PendingIndexItemResponse } from '../../api/types';
import { ApiError } from '../../api/client';
import { base64ToBytes } from '../../crypto/encoding';
import { decryptSmall } from '../../crypto/aesGcm';
import { eciesDecrypt } from '../../crypto/keyExchange';
import {
  uploadDocument,
  fetchAndDecryptOwnDocument,
  DOCUMENT_KEY_ENVELOPE_TAG,
  type DecryptedDocument,
} from '../../services/documentCrypto';
import { processPendingIndexItem } from '../../services/indexing';

interface ListItem {
  doc: DocumentResponse;
  title: string;
  docType: string;
}

export default function DocumentsPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();
  const keys = session.patientKeys!;

  const [items, setItems] = useState<ListItem[]>([]);
  const [pending, setPending] = useState<PendingIndexItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, DecryptedDocument | 'loading' | 'error'>>({});

  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('nota_general');
  const [content, setContent] = useState('');
  const [categories, setCategories] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, pendingItems] = await Promise.all([
        api.get<DocumentResponse[]>('/api/v1/patients/me/documents'),
        api.get<PendingIndexItemResponse[]>('/api/v1/patients/me/pending-index'),
      ]);
      const decorated: ListItem[] = [];
      for (const doc of docs) {
        try {
          const kDoc = await eciesDecrypt(keys.identity.secretKey, base64ToBytes(doc.encrypted_key_envelope_base64), DOCUMENT_KEY_ENVELOPE_TAG);
          const title = new TextDecoder().decode(await decryptSmall(kDoc, base64ToBytes(doc.title_encrypted_base64)));
          const docType = new TextDecoder().decode(await decryptSmall(kDoc, base64ToBytes(doc.doc_type_encrypted_base64)));
          kDoc.fill(0);
          decorated.push({ doc, title, docType });
        } catch {
          decorated.push({ doc, title: '(no se pudo descifrar el título)', docType: '' });
        }
      }
      setItems(decorated);
      setPending(pendingItems);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando el historial');
    } finally {
      setLoading(false);
    }
  }, [api, keys]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadMsg(null);
    setUploadBusy(true);
    try {
      await uploadDocument({
        api,
        patientId: session.userId!,
        patientPublicKey: keys.identity.publicKey,
        title,
        docType,
        contentText: content,
        categories: categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        liveKeys: { kIdx: keys.kIdx, kEnc: keys.kEnc },
      });
      setTitle('');
      setContent('');
      setCategories('');
      setUploadMsg('Documento subido e indexado.');
      await refresh();
    } catch (err) {
      setUploadMsg(err instanceof ApiError ? `Error: ${err.message}` : 'Error al subir el documento');
    } finally {
      setUploadBusy(false);
    }
  };

  const onToggleExpand = async (documentId: string) => {
    if (expanded[documentId] && expanded[documentId] !== 'error') {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [documentId]: 'loading' }));
    try {
      const decrypted = await fetchAndDecryptOwnDocument(api, session.userId!, documentId, keys.identity.secretKey);
      setExpanded((prev) => ({ ...prev, [documentId]: decrypted }));
    } catch {
      setExpanded((prev) => ({ ...prev, [documentId]: 'error' }));
    }
  };

  const onProcessPending = async (documentId: string) => {
    setProcessingId(documentId);
    try {
      await processPendingIndexItem({
        api,
        patientId: session.userId!,
        identitySecretKey: keys.identity.secretKey,
        kIdx: keys.kIdx,
        kEnc: keys.kEnc,
        documentId,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error procesando el documento pendiente');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Subir un documento</h2>
        <form onSubmit={onUpload}>
          <div className="panel-row">
            <label>
              Título
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Tipo
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="nota_general">Nota general</option>
                <option value="lab_result">Resultado de laboratorio</option>
                <option value="imaging">Imagen/estudio</option>
                <option value="prescription">Receta</option>
                <option value="discharge_summary">Epicrisis</option>
              </select>
            </label>
          </div>
          <label>
            Contenido
            <textarea required rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          <label>
            Categorías para restringir delegaciones (separadas por coma; vacío = sin restricción)
            <input
              placeholder="cardiología, endocrinología"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
            />
          </label>
          {uploadMsg && <p className={uploadMsg.startsWith('Error') ? 'error' : 'success-note'}>{uploadMsg}</p>}
          <button type="submit" disabled={uploadBusy}>
            {uploadBusy ? 'Cifrando y subiendo…' : 'Subir documento'}
          </button>
        </form>
      </div>

      {pending.length > 0 && (
        <div className="panel">
          <h2>Por indexar ({pending.length})</h2>
          <p className="empty-note">
            Documentos que un médico/clínica subió sin tener acceso vigente a tu índice de búsqueda. Procesalos para
            poder buscarlos y para que un futuro médico delegado pueda leerlos directamente.
          </p>
          <div className="entry-list">
            {pending.map((item) => (
              <div className="entry" key={item.document_id}>
                <div className="entry-header">
                  <span className="entry-meta">Subido {new Date(item.created_at).toLocaleString()}</span>
                  <button type="button" disabled={processingId === item.document_id} onClick={() => onProcessPending(item.document_id)}>
                    {processingId === item.document_id ? 'Procesando…' : 'Procesar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Tu historial</h2>
        {loading && <p className="empty-note">Cargando…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && items.length === 0 && <p className="empty-note">Todavía no subiste ningún documento.</p>}
        <div className="entry-list">
          {items.map(({ doc, title, docType }) => (
            <div className="entry" key={doc.document_id}>
              <div className="entry-header">
                <div>
                  <div className="entry-title">{title}</div>
                  <div className="entry-meta">
                    {docType} · {new Date(doc.created_at).toLocaleString()}
                  </div>
                </div>
                <button type="button" className="secondary" onClick={() => onToggleExpand(doc.document_id)}>
                  {expanded[doc.document_id] ? 'Ocultar' : 'Ver contenido'}
                </button>
              </div>
              {expanded[doc.document_id] === 'loading' && <p className="progress-note">Descifrando…</p>}
              {expanded[doc.document_id] === 'error' && <p className="error">No se pudo descifrar el documento.</p>}
              {expanded[doc.document_id] && expanded[doc.document_id] !== 'loading' && expanded[doc.document_id] !== 'error' && (
                <div className="entry-content">{(expanded[doc.document_id] as DecryptedDocument).content}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
