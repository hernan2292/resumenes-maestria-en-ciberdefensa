// Web Worker que tokeniza texto clínico fuera del hilo principal, para no
// congelar la UI al indexar/subir documentos grandes (ver crypto/sseCore.ts
// -> tokenize()). El worker es deliberadamente "tonto": sólo recibe el
// texto plano que el hilo principal YA decidió mandarle — que a su vez
// nunca salió del navegador del paciente — y devuelve la lista de palabras
// clave únicas. No importa nada de red ni de claves.
import { tokenize } from '../crypto/sseCore';

export interface TokenizeRequest {
  requestId: number;
  text: string;
}

export interface TokenizeResponse {
  requestId: number;
  keywords: string[];
}

self.onmessage = (event: MessageEvent<TokenizeRequest>) => {
  const { requestId, text } = event.data;
  const keywords = tokenize(text);
  const response: TokenizeResponse = { requestId, keywords };
  (self as unknown as Worker).postMessage(response);
};
