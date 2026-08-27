// Cliente HTTP fino. Nunca persiste el token: quien lo llama decide dónde
// vive el token (ver CryptoSessionContext.tsx — sólo en memoria, jamás en
// localStorage, para minimizar el impacto de un XSS).
import type { ApiErrorBody } from './types';

// Acceso defensivo a import.meta.env: bajo Vite siempre está poblado, pero
// este módulo también se importa directamente (sin bundler) desde
// integration-test/run.ts vía tsx, donde import.meta.env es undefined.
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ApiClientOptions {
  getToken: () => string | null;
}

export class ApiClient {
  private opts: ApiClientOptions;
  constructor(opts: ApiClientOptions) {
    this.opts = opts;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.opts.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let message = `error HTTP ${res.status}`;
      try {
        const parsed = (await res.json()) as ApiErrorBody;
        if (parsed.error) message = parsed.error;
      } catch {
        // el cuerpo no era JSON; nos quedamos con el mensaje genérico
      }
      throw new ApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }
}
