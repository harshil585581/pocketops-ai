import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from './toast';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  canInstall: boolean;
  installed: boolean;
  offlineReady: boolean;
  install(): Promise<void>;
}

const Ctx = createContext<PwaState>({ canInstall: false, installed: false, offlineReady: false, install: async () => {} });

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function PwaProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [swReady, setSwReady] = useState(false);

  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError: (e) => console.error("[pwa] service worker registration failed", e),
  });

  useEffect(() => {
    navigator.serviceWorker?.ready.then(() => setSwReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      push({ tone: 'success', title: 'PocketOps installed', body: 'Launch it from your home screen or app list.' });
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [push]);

  useEffect(() => {
    if (offlineReady)
      push({ tone: 'success', title: 'Ready to work offline', body: 'The app is cached on this device.' });
  }, [offlineReady, push]);

  useEffect(() => {
    if (needRefresh)
      push({
        tone: 'info',
        title: 'Update available',
        body: 'A new version of PocketOps is ready.',
        sticky: true,
        action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
      });
  }, [needRefresh, push, updateServiceWorker]);

  const install = async () => {
    const e = deferred.current;
    if (!e) return;
    await e.prompt();
    await e.userChoice;
    deferred.current = null;
    setCanInstall(false);
  };

  return (
    <Ctx.Provider value={{ canInstall, installed, offlineReady: offlineReady || swReady, install }}>
      {children}
    </Ctx.Provider>
  );
}

export const usePwa = () => useContext(Ctx);
