/**
 * WebSocket singleton + emitter factory for httpBridge.
 * Used by renderer to receive backend-originated events.
 *
 * When backend is unavailable, wsEmitter.on() falls back to the in-process
 * platform bridge (see httpBridgeFallback.ts) so renderer still receives events
 * that the main process emits.
 */

import { buildEmitterFallback, shouldUseFallback, isMainProcess } from './httpBridgeFallback';

declare global {
  interface Window {
    __backendPort?: number;
  }
}

function getWsUrl(): string {
  const port = typeof window !== 'undefined' ? (window as Window).__backendPort || 13400 : 13400;
  return `ws://127.0.0.1:${port}/ws`;
}

type WsCallback = (data: unknown) => void;
const wsListeners = new Map<string, Set<WsCallback>>();
let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsReconnectAttempt = 0;

function ensureWs(): void {
  if (typeof window === 'undefined') return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const url = getWsUrl();
  try {
    ws = new WebSocket(url);
  } catch {
    scheduleWsReconnect();
    return;
  }

  const current = ws;

  current.addEventListener('open', () => {
    wsReconnectAttempt = 0;
  });

  current.addEventListener('message', (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        name?: string;
        event?: string;
        data?: unknown;
        payload?: unknown;
      };
      const eventName = msg.name ?? msg.event;
      const payload = msg.data ?? msg.payload;
      if (eventName) {
        const handlers = wsListeners.get(eventName);
        if (handlers) {
          for (const h of handlers) {
            try {
              h(payload);
            } catch {
              /* never crash listener */
            }
          }
        }
      }
    } catch {
      // ignore non-JSON
    }
  });

  current.addEventListener('close', () => {
    if (ws === current) ws = null;
    scheduleWsReconnect();
  });

  current.addEventListener('error', () => {
    current.close();
  });
}

function scheduleWsReconnect(): void {
  if (wsReconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempt), 30000);
  wsReconnectAttempt++;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    ensureWs();
  }, delay);
}

type EmitterLike<Params> = {
  on: (callback: Params extends undefined ? () => void : (params: Params) => void) => () => void;
  emit: Params extends undefined ? () => void : (params: Params) => void;
};

type EmitterOptions = {
  /** dotted key used for platform-bridge fallback when backend is unavailable */
  key?: string;
};

export function wsEmitter<Params = undefined>(eventName: string, options?: EmitterOptions): EmitterLike<Params> {
  const fallback = options?.key ? buildEmitterFallback<Params>(options.key) : null;

  return {
    on: (callback: (params: Params) => void) => {
      // Renderer: subscribe to WS; also subscribe to in-process fallback (no-op if backend is present).
      ensureWs();
      if (!wsListeners.has(eventName)) {
        wsListeners.set(eventName, new Set());
      }
      const cb = callback as WsCallback;
      wsListeners.get(eventName)!.add(cb);

      let offFallback: (() => void) | undefined;
      if (fallback && shouldUseFallback()) {
        offFallback = fallback.on(callback);
      }

      return () => {
        wsListeners.get(eventName)?.delete(cb);
        offFallback?.();
      };
    },
    emit: ((params?: Params) => {
      // Main process: emit through platform bridge so renderer listeners receive it.
      if (fallback && isMainProcess()) {
        fallback.emit(params as Params);
      }
      // Renderer-side .emit remains a no-op (events only flow main->renderer).
    }) as EmitterLike<Params>['emit'],
  };
}

export function stubEmitter<Params = undefined>(_name: string): EmitterLike<Params> {
  return {
    on: () => () => {},
    emit: (() => {}) as EmitterLike<Params>['emit'],
  };
}
