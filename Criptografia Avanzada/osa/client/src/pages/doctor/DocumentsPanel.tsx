// Subida de un documento para un paciente (Flujo A, Sección 4.1): no
// requiere una delegación de LECTURA activa (subir y leer son permisos
// distintos por diseño — ver document_service.go), sólo la clave pública
// X25519 del paciente, obtenida por su código público. Si además el médico
// tiene consumida una delegación vigente para ese paciente en esta sesión,
// el documento se indexa con trapdoors reales en el acto (adenda punto 16);
// si no, queda "por indexar" hasta que el paciente lo procese.
import { useState } from 'react';
import { useCryptoSession } from '../../context/CryptoSessionContext';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import type { PublicUserResponse } from '../../api/types';
import { base64ToBytes } from '../../crypto/encoding';
import { uploadDocument } from '../../services/documentCrypto';

export default function DocumentsPanel() {
  const session = useCryptoSession();
  const { api } = useAuth();

  const [patientCode, setPatientCode] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('lab_result');
  const [content, setContent] = useState('');
  const [categories, setCategories] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const patient = await api.get<PublicUserResponse>(`/api/v1/users/by-code/${patientCode.trim()}`);
      if (patient.role !== 'patient') {
        throw new ApiError(400, 'El código no corresponde a un paciente');
      }
      const consumed = session.getConsumedDelegation(patient.user_id);
      const doc = await uploadDocument({
        api,
        patientId: patient.user_id,
        patientPublicKey: base64ToBytes(patient.public_key_base64),
        title,
        docType,
        contentText: content,
        categories: categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        liveKeys: consumed ? { kIdx: consumed.kIdx, kEnc: consumed.kEnc, delegationId: consumed.delegationId } : undefined,
      });
      setMsg(
        consumed
          ? `Documento ${doc.document_id} subido e indexado (tenías delegación activa para este paciente).`
          : `Documento ${doc.document_id} subido. Como no tenías una delegación activa para este paciente en esta sesión, quedó "por indexar" hasta que el paciente lo procese.`
      );
      setTitle('');
      setContent('');
      setCategories('');
    } catch (err) {
      setMsg(err instanceof ApiError ? `Error: ${err.message}` : 'Error al subir el documento');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Subir un documento para un paciente</h2>
      <form onSubmit={onUpload}>
        <label>
          Código público del paciente
          <input required placeholder="OSA-XXXX-XXXX" value={patientCode} onChange={(e) => setPatientCode(e.target.value)} />
        </label>
        <div className="panel-row">
          <label>
            Título
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Tipo
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              <option value="lab_result">Resultado de laboratorio</option>
              <option value="imaging">Imagen/estudio</option>
              <option value="prescription">Receta</option>
              <option value="discharge_summary">Epicrisis</option>
              <option value="nota_general">Nota general</option>
            </select>
          </label>
        </div>
        <label>
          Contenido
          <textarea required rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        </label>
        <label>
          Categorías (separadas por coma; deben coincidir con las que el paciente usa para restringir delegaciones)
          <input placeholder="cardiología" value={categories} onChange={(e) => setCategories(e.target.value)} />
        </label>
        {msg && <p className={msg.startsWith('Error') ? 'error' : 'success-note'}>{msg}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Cifrando y subiendo…' : 'Subir documento'}
        </button>
      </form>
    </div>
  );
}
