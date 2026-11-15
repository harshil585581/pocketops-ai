import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Cloud, Cpu, Loader2, X } from 'lucide-react';
import type { Route } from '../engine';
import { cx } from './ui';

const STAGES = ['Reading your description', 'Identifying likely causes', 'Building a step-by-step plan', 'Checking safety precautions'];

export function Analyzing({ problem, route, onCancel }: { problem: string; route: Route; onCancel(): void }) {
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = performance.now();
    const a = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 750);
    const b = setInterval(() => setElapsed(performance.now() - t0), 100);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  const local = route.target === 'on-device';
  const Icon = local ? Cpu : Cloud;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-4"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="card overflow-hidden">
        <div className="relative h-0.5 overflow-hidden bg-line">
          <div className="scan" />
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span
              className={cx(
                'inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium',
                local ? 'border-local/25 bg-local/8 text-local' : 'border-cloud/25 bg-cloud/8 text-cloud',
              )}
            >
              <Icon className="size-3.5" />
              {local ? 'Running on-device' : 'Running in cloud'}
              <span className="opacity-50">·</span>
              <span className="font-mono">{route.model}</span>
            </span>
            <span className="hidden font-mono text-[10.5px] text-ink-3 sm:inline">
              firebase/ai · {route.inferenceMode?.toUpperCase()}
            </span>
            <span className="font-mono text-xs text-ink-3 tabular-nums">{(elapsed / 1000).toFixed(1)}s</span>
          </div>

          <blockquote className="mb-6 border-l-2 border-line-strong pl-4 text-[15px] leading-relaxed text-ink-2">
            {problem}
          </blockquote>

          <ol className="space-y-3">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <motion.li
                  key={s}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: i <= stage ? 1 : 0.35, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 text-sm"
                >
                  <span
                    className={cx(
                      'grid size-5 place-items-center rounded-full border transition-colors',
                      done ? 'border-local bg-local text-[#04140d]' : active ? 'border-local/50 text-local' : 'border-line-strong text-ink-3',
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : active ? <Loader2 className="size-3 animate-spin" /> : null}
                  </span>
                  <span className={cx(active ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-3')}>{s}</span>
                </motion.li>
              );
            })}
          </ol>
        </div>
        <div className="flex items-center justify-between border-t border-line bg-surface-2/50 px-5 py-3">
          <p className="text-[12.5px] text-ink-3">
            {local ? 'Your description stays on this device.' : 'Sent securely to Gemini via Firebase AI Logic.'}
          </p>
          <button onClick={onCancel} className="btn-ghost h-8 text-[13px]">
            <X className="size-3.5" /> Cancel
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="card space-y-3 p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
