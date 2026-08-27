// Envoltorio que despacha la tokenización a workers/textIndexer.worker.ts
// cuando el entorno soporta Web Workers (todo navegador moderno), para que
// tokenizar un documento largo no bloquee la UI ni el timer de auto-lock de
// CryptoSessionContext. Si no hay soporte de Worker (p. ej. algún entorno
// de test), cae de vuelta a tokenize() síncrono con el mismo resultado.
import type { TokenizeRequest, TokenizeResponse } from '../workers/textIndexer.worker';
import { tokenize } from './sseCore';

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, (keywords: string[]) => void>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('../workers/textIndexer.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<TokenizeResponse>) => {
      const resolve = pending.get(event.data.requestId);
      if (resolve) {
        pending.delete(event.data.requestId);
        resolve(event.data.keywords);
      }
    };
  }
  return worker;
}

export function tokenizeAsync(text: string): Promise<string[]> {
  const w = getWorker();
  if (!w) return Promise.resolve(tokenize(text));
  const requestId = nextRequestId++;
  return new Promise((resolve) => {
    pending.set(requestId, resolve);
    const req: TokenizeRequest = { requestId, text };
    w.postMessage(req);
  });
}
