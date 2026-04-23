/**
 * Fallback registry: when aionui-backend is unavailable, route httpBridge
 * provider/invoke calls through the in-process @office-ai/platform bridge
 * (Electron IPC) instead of HTTP/WS.
 *
 * Transparent: when backend IS available, nothing here runs.
 *
 * Detection:
 *   - Main process:  typeof window === 'undefined'          (provider side)
 *   - Renderer:      window.__backendPort === 0 or missing  (invoke side)
 */

import { bridge } from '@office-ai/platform';

declare global {
  interface Window {
    __backendPort?: number;
  }
}

export function isMainProcess(): boolean {
  return typeof window === 'undefined';
}

/**
 * Renderer-only check: backend is not reachable, so invoke must fall through
 * to the in-process platform bridge.
 */
export function shouldUseFallback(): boolean {
  if (typeof window === 'undefined') return false;
  const port = (window as Window).__backendPort;
  return !port || port === 0;
}

type AnyProvider = {
  provider: (handler: (params: unknown) => Promise<unknown>) => void;
  invoke: (params?: unknown) => Promise<unknown>;
};

type AnyEmitter = {
  on: (callback: (params: unknown) => void) => () => void;
  emit: (params?: unknown) => void;
};

type ProviderFallback<Data, Params> = {
  provider: (handler: (params: Params) => Promise<Data>) => void;
  invoke: (params?: Params) => Promise<Data>;
};

type EmitterFallback<Params> = {
  on: (callback: (params: Params) => void) => () => void;
  emit: (params: Params) => void;
};

const providerCache = new Map<string, AnyProvider>();
const emitterCache = new Map<string, AnyEmitter>();

function getProvider(key: string): AnyProvider {
  let p = providerCache.get(key);
  if (!p) {
    p = bridge.buildProvider<unknown, unknown>(key) as unknown as AnyProvider;
    providerCache.set(key, p);
  }
  return p;
}

function getEmitter(key: string): AnyEmitter {
  let e = emitterCache.get(key);
  if (!e) {
    e = bridge.buildEmitter<unknown>(key) as unknown as AnyEmitter;
    emitterCache.set(key, e);
  }
  return e;
}

/**
 * Returns an object whose `.provider()` registers a handler on the platform
 * bridge (main-side) and whose `.invoke()` goes through Electron IPC
 * (renderer-side). This is the in-process fallback path.
 */
export function buildProviderFallback<Data, Params>(key: string): ProviderFallback<Data, Params> {
  return {
    provider: (handler) => {
      getProvider(key).provider(handler as (params: unknown) => Promise<unknown>);
    },
    invoke: (params?: Params) => getProvider(key).invoke(params) as Promise<Data>,
  };
}

export function buildEmitterFallback<Params>(key: string): EmitterFallback<Params> {
  return {
    on: (callback) => getEmitter(key).on(callback as (params: unknown) => void),
    emit: (params) => getEmitter(key).emit(params),
  };
}
