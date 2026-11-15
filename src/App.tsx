import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MobileHeader, MobileTabBar, Sidebar } from './components/Shell';
import { EngineProvider, useEngine } from './state/engine';
import { PwaProvider } from './state/pwa';
import { ThemeProvider } from './state/theme';
import { ToastProvider, useToast } from './state/toast';
import { seedIfNeeded } from './lib/db';
import { initRemoteConfig } from './lib/remoteConfig';
import { startSync } from './lib/sync';
import Diagnose from './pages/Diagnose';

const History = lazy(() => import('./pages/History'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const Engine = lazy(() => import('./pages/Engine'));

function ConnectivityToasts() {
  const { online, local } = useEngine();
  const { push } = useToast();
  const prev = useRef<boolean | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = online;
    if (was === null || was === online) return;
    push(
      online
        ? { tone: 'success', title: 'Back online', body: 'Cloud Gemini is available again.' }
        : {
            tone: 'info',
            title: 'You’re offline',
            body: local === 'available' ? 'Gemini Nano will keep working on-device.' : 'Saved guidance is still available.',
          },
    );
  }, [online]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.12 } }}
        transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
      >
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Routes location={location}>
            <Route path="/" element={<Diagnose />} />
            <Route path="/saved" element={<History />} />
            <Route path="/s/:id" element={<SessionDetail />} />
            <Route path="/engine" element={<Engine />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  useEffect(() => {
    seedIfNeeded().catch(() => {});
    initRemoteConfig();
    startSync();
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <PwaProvider>
          <EngineProvider>
            <BrowserRouter>
              <div className="app-backdrop" aria-hidden />
              <a
                href="#main"
                className="sr-only z-50 rounded-lg bg-ink px-3 py-2 text-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
              >
                Skip to content
              </a>
              <Sidebar />
              <MobileHeader />
              <main id="main" className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">
                <AnimatedRoutes />
              </main>
              <MobileTabBar />
              <ConnectivityToasts />
            </BrowserRouter>
          </EngineProvider>
        </PwaProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
