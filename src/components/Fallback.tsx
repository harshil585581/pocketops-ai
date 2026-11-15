import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, Cpu, RotateCcw, WifiOff } from 'lucide-react';
import { findRelated } from '../lib/db';
import type { Session } from '../lib/types';
import { SessionCard } from './SessionCard';

export function OfflineFallback({ problem, reason, onBack }: { problem: string; reason: string; onBack(): void }) {
  const [related, setRelated] = useState<Session[] | null>(null);
  useEffect(() => {
    findRelated(problem).then(setRelated).catch(() => setRelated([]));
  }, [problem]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="card overflow-hidden">
        <div className="flex gap-4 p-5 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-warn/12 text-warn">
            <WifiOff className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight">AI generation is unavailable right now</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{reason}</p>
            <ul className="mt-4 space-y-2 text-[13.5px] text-ink-2">
              <li className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                Reconnect to the internet to use cloud Gemini.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                While online, prepare Gemini Nano so future requests work fully offline.
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2/50 px-5 py-3">
          <button onClick={onBack} className="btn-ghost h-8 text-[13px]">
            <ArrowLeft className="size-3.5" /> Edit description
          </button>
          <Link to="/settings" className="btn-ghost h-8 text-[13px]">
            <Cpu className="size-3.5" /> Set up on-device AI
          </Link>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="label">Saved guidance that may help</h3>
          {related && related.length > 0 && <span className="font-mono text-[11px] text-ink-3">{related.length} match</span>}
        </div>
        {related === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-[84px] !rounded-2xl" />
            ))}
          </div>
        ) : related.length ? (
          <div className="space-y-2">
            {related.map((s) => (
              <SessionCard key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-3">
            No related saved guidance on this device yet.
          </div>
        )}
      </section>
    </motion.div>
  );
}

export function ErrorPanel({ message, onRetry, onBack }: { message: string; onRetry(): void; onBack(): void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden" role="alert">
      <div className="flex gap-4 p-5 sm:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-danger/12 text-danger">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">We couldn’t generate guidance</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{message}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line bg-surface-2/50 px-5 py-3">
        <button onClick={onRetry} className="btn-primary h-8 text-[13px]">
          <RotateCcw className="size-3.5" /> Try again
        </button>
        <button onClick={onBack} className="btn-ghost h-8 text-[13px]">
          <ArrowLeft className="size-3.5" /> Edit description
        </button>
      </div>
    </motion.div>
  );
}
