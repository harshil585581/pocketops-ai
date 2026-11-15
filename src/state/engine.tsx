import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EngineMode } from '../lib/types';
import { downloadLocalModel, getLocalAvailability, type LocalAvailability } from '../engine/chromeAI';
import { planRoute, type EngineSnapshot, type Route } from '../engine';
import { firebaseConfigured } from '../engine/firebase';

interface EngineState extends EngineSnapshot {
  route: Route;
  cloudConfigured: boolean;
  checking: boolean;
  downloadProgress: number | null;
  downloadError: string | null;
  setMode(mode: EngineMode): void;
  refresh(): Promise<void>;
  download(): Promise<void>;
}

const Ctx = createContext<EngineState | null>(null);
const MODE_KEY = 'pocketops:mode';

function readMode(): EngineMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'auto' || m === 'local-only' || m === 'cloud-only') return m;
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function EngineProvider({ children }: { children: ReactNode }) {
  const online = useOnline();
  const [local, setLocal] = useState<LocalAvailability>('unavailable');
  const [checking, setChecking] = useState(true);
  const [mode, setModeState] = useState<EngineMode>(readMode);
  const [downloadProgress, setProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    setLocal(await getLocalAvailability());
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  const setMode = useCallback((m: EngineMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const download = useCallback(async () => {
    setDownloadError(null);
    setProgress(0);
    setLocal('downloading');
    try {
      await downloadLocalModel((f) => setProgress(f));
      setProgress(1);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      await refresh();
      setTimeout(() => setProgress(null), 1200);
    }
  }, [refresh]);

  const value = useMemo<EngineState>(() => {
    const snap = { online, local, mode };
    return {
      ...snap,
      route: planRoute(snap),
      cloudConfigured: firebaseConfigured,
      checking,
      downloadProgress,
      downloadError,
      setMode,
      refresh,
      download,
    };
  }, [online, local, mode, checking, downloadProgress, downloadError, setMode, refresh, download]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngine() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEngine must be used within EngineProvider');
  return v;
}
