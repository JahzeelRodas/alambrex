import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  connected: boolean;
  lastUpdated: number;
}

interface UsePollingOptions<T> {

  applyData?: (prev: T | null, next: T) => T;
  enabled?: boolean;
}

export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  options: UsePollingOptions<T> = {}
) {
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    error: null,
    connected: false,
    lastUpdated: 0,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const applyRef = useRef(options.applyData);
  applyRef.current = options.applyData;
  const enabled = options.enabled !== false;

  const timerRef = useRef<number | null>(null);
  const backoffRef = useRef(1);
  const tickRef = useRef<() => void>(() => undefined);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    let busy = false;

    const run = async (): Promise<void> => {
      if (busy) return;
      busy = true;
      try {
        const data = await fetcherRef.current(controller.signal);
        backoffRef.current = 1;
        setState((prev) => {
          const applied = applyRef.current ? applyRef.current(prev.data, data) : data;

          if (applied === prev.data) return { ...prev, error: null, connected: true, lastUpdated: Date.now() };
          return { data: applied, error: null, connected: true, lastUpdated: Date.now() };
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        backoffRef.current = Math.min(backoffRef.current * 1.6, 4);
        const message =
          error instanceof Error && error.name !== 'AbortError'
            ? error.message
            : 'Sin conexión con el servidor';
        setState((prev) => ({ ...prev, error: message, connected: false }));
      } finally {
        busy = false;
      }
    };

    const schedule = (multiplier: number): void => {
      if (cancelled) return;
      const hidden = document.visibilityState === 'hidden';
      const base = intervalMs * (hidden ? 4 : 1) * multiplier;
      timerRef.current = window.setTimeout(tick, Math.max(base, 1000));
    };

    const tick = (): void => {
      if (cancelled || !enabledRef.current) return;
      void run().finally(() => schedule(backoffRef.current));
    };

    tickRef.current = tick;
    tick();

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        tick();
      }
    };
    const onOnline = onVisible;

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, intervalMs]);

  const refresh = useCallback(() => {
    tickRef.current();
  }, []);

  return { ...state, refresh };
}
