/**
 * HTTP/WS bridge factory — drop-in replacement for bridge.buildProvider / bridge.buildEmitter
 * that routes calls to aionui-backend via REST API and WebSocket.
 *
 * Exported helpers produce objects with the same shape as @office-ai/platform bridge,
 * so existing renderer code works without changes.
 *
 * When the aionui-backend binary is unavailable (__backendPort === 0), calls
 * with an explicit `key` option transparently fall back to the in-process
 * platform bridge (Electron IPC). See httpBridgeFallback.ts.
 */

import { buildProviderFallback, shouldUseFallback, isMainProcess } from './httpBridgeFallback';

export { wsEmitter, stubEmitter } from './httpBridgeWs';

declare global {
  interface Window {
    __backendPort?: number;
  }
}

function getBaseUrl(): string {
  const port = typeof window !== 'undefined' ? (window as Window).__backendPort || 13400 : 13400;
  return `http://127.0.0.1:${port}`;
}

// ---------------------------------------------------------------------------
// HTTP request helper
// ---------------------------------------------------------------------------

async function httpRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new Error(`Backend ${method} ${path} failed (${response.status}): ${JSON.stringify(errorBody)}`);
  }

  const contentType = response.headers.get('Content-Type');
  if (!contentType?.includes('application/json')) {
    return undefined as T;
  }

  const json = await response.json();
  // Backend wraps in { success, data, ... } — unwrap when present
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Provider factories (same shape as bridge.buildProvider)
// ---------------------------------------------------------------------------

type ProviderLike<Data, Params> = {
  provider: (handler: (params: Params) => Promise<Data>) => void;
  invoke: Params extends undefined ? () => Promise<Data> : (params: Params) => Promise<Data>;
};

type ProviderOptions = {
  /** Dotted key (e.g. `'team.list'`) used for in-process fallback via platform bridge. */
  key?: string;
};

/**
 * Build a provider object that routes to HTTP in renderer, but falls back to
 * @office-ai/platform IPC bridge when:
 *   - Main process is registering a handler via `.provider(...)`
 *   - Renderer calls `.invoke(...)` and backend is unavailable
 */
function buildProvider<Data, Params>(
  httpInvoker: (params?: Params) => Promise<Data>,
  options?: ProviderOptions
): ProviderLike<Data, Params> {
  const fallback = options?.key ? buildProviderFallback<Data, Params>(options.key) : null;

  return {
    provider: (handler) => {
      // Main process: register the handler on platform bridge so renderer can reach it
      // via Electron IPC when the backend is down. When backend is up, the HTTP server
      // inside aionui-backend is the real handler — this provider registration is harmless.
      if (fallback && isMainProcess()) {
        fallback.provider(handler);
      }
    },
    invoke: (async (params?: Params) => {
      if (fallback && shouldUseFallback()) {
        return fallback.invoke(params);
      }
      return httpInvoker(params);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function httpGet<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  options?: ProviderOptions
): ProviderLike<Data, Params> {
  return buildProvider<Data, Params>((params?: Params) => {
    const resolvedPath = typeof path === 'function' ? path(params!) : path;
    return httpRequest<Data>('GET', resolvedPath);
  }, options);
}

export function httpPost<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown,
  options?: ProviderOptions
): ProviderLike<Data, Params> {
  return buildProvider<Data, Params>((params?: Params) => {
    const resolvedPath = typeof path === 'function' ? path(params!) : path;
    const body = mapBody ? mapBody(params!) : params;
    return httpRequest<Data>('POST', resolvedPath, body);
  }, options);
}

export function httpPut<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown,
  options?: ProviderOptions
): ProviderLike<Data, Params> {
  return buildProvider<Data, Params>((params?: Params) => {
    const resolvedPath = typeof path === 'function' ? path(params!) : path;
    const body = mapBody ? mapBody(params!) : params;
    return httpRequest<Data>('PUT', resolvedPath, body);
  }, options);
}

export function httpPatch<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown,
  options?: ProviderOptions
): ProviderLike<Data, Params> {
  return buildProvider<Data, Params>((params?: Params) => {
    const resolvedPath = typeof path === 'function' ? path(params!) : path;
    const body = mapBody ? mapBody(params!) : params;
    return httpRequest<Data>('PATCH', resolvedPath, body);
  }, options);
}

export function httpDelete<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  options?: ProviderOptions
): ProviderLike<Data, Params> {
  return buildProvider<Data, Params>((params?: Params) => {
    const resolvedPath = typeof path === 'function' ? path(params!) : path;
    return httpRequest<Data>('DELETE', resolvedPath);
  }, options);
}

/**
 * Stub provider for features not yet implemented in the backend.
 * Returns a sensible default value and logs a warning.
 */
export function stubProvider<Data, Params = undefined>(name: string, defaultValue: Data): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (_params?: Params) => {
      console.warn(`[httpBridge] stub: ${name} not yet implemented in backend`);
      return defaultValue;
    }) as ProviderLike<Data, Params>['invoke'],
  };
}
