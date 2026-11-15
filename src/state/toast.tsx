import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Tone = 'success' | 'info' | 'error';
interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
  action?: { label: string; onClick(): void };
  sticky?: boolean;
}

type Push = (t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => number;
const Ctx = createContext<{ push: Push; dismiss(id: number): void }>({ push: () => 0, dismiss() {} });

let seq = 0;
const ICON = { success: CheckCircle2, info: Info, error: AlertTriangle };
const TONE = { success: 'text-local', info: 'text-cloud', error: 'text-danger' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<Push>(
    (t) => {
      const id = ++seq;
      setToasts((list) => [...list.slice(-2), { tone: 'info', ...t, id }]);
      if (!t.sticky) setTimeout(() => dismiss(id), 4200);
      return id;
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ push, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 lg:top-[4.5rem] lg:items-end lg:pr-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICON[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line p-3.5 pr-2.5 shadow-pop"
                role="status"
              >
                <Icon className={`mt-0.5 size-4.5 shrink-0 ${TONE[t.tone]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t.body}</p>}
                </div>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-canvas transition hover:opacity-90"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded-md p-1 text-ink-3 transition hover:bg-surface-2 hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
