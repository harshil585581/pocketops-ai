import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { Composer, type ComposerHandle } from '../components/Composer';
import { Analyzing } from '../components/Analyzing';
import { ErrorPanel, OfflineFallback } from '../components/Fallback';
import { RoutingMatrix } from '../components/RoutingMatrix';
import { SessionCard } from '../components/SessionCard';
import { StatusDot, cx } from '../components/ui';
import { EngineUnavailableError, planRoute, runDiagnosis, sessionFromResult, type Route } from '../engine';
import { EXAMPLE_PROMPTS } from '../lib/samples';
import { categoryById, detectCategory } from '../lib/categories';
import { putSession } from '../lib/db';
import type { CategoryId } from '../lib/types';
import { useSessions } from '../lib/useSessions';
import { useEngine } from '../state/engine';

type Phase =
  | { kind: 'idle' }
  | { kind: 'running'; route: Route }
  | { kind: 'fallback'; reason: string }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'pocketops:draft';
const readDraft = () => {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
};

export default function Diagnose() {
  const engine = useEngine();
  const navigate = useNavigate();
  const { sessions } = useSessions();
  const composer = useRef<ComposerHandle>(null);
  const abort = useRef<AbortController | null>(null);

  const [text, setText] = useState(readDraft);
  const [category, setCategory] = useState<CategoryId | 'auto'>('auto');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, text);
    } catch {
      /* ignore */
    }
  }, [text]);

  useEffect(() => () => abort.current?.abort(), []);

  async function submit() {
    const problem = text.trim();
    if (!problem) return;
    const cat = category === 'auto' ? detectCategory(problem) : category;
    const { online, local, mode } = engine;
    const route = planRoute({ online, local, mode }, { problemLength: problem.length });

    if (route.target === 'none') {
      setPhase({ kind: 'fallback', reason: route.reason });
      return;
    }

    const ac = new AbortController();
    abort.current = ac;
    setPhase({ kind: 'running', route });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const r = await runDiagnosis(problem, cat, { online, local, mode }, { signal: ac.signal });
      const session = sessionFromResult(problem, r);
      await putSession(session);
      setText('');
      navigate(`/s/${session.id}`, { state: { fresh: true } });
    } catch (e) {
      if (ac.signal.aborted) return setPhase({ kind: 'idle' });
      if (e instanceof EngineUnavailableError || !navigator.onLine) {
        setPhase({
          kind: 'fallback',
          reason: e instanceof EngineUnavailableError ? e.message : 'The connection dropped and the local model could not answer.',
        });
      } else {
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong while generating guidance.' });
      }
    }
  }

  const back = () => {
    setPhase({ kind: 'idle' });
    requestAnimationFrame(() => composer.current?.focus());
  };

  const recent = sessions.slice(0, 3);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-10 lg:py-12">
      <div className="min-w-0">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          className="mb-7 lg:mb-9"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-2">
              {engine.online ? <Wifi className="size-3" /> : <WifiOff className="size-3 text-warn" />}
              {engine.online ? 'Online' : 'Offline'}
            </span>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-2">
              <StatusDot tone={engine.local === 'available' ? 'local' : 'muted'} pulse={engine.local === 'available'} />
              Gemini Nano {engine.local === 'available' ? 'ready' : 'not ready'}
            </span>
          </div>
          <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[44px]">
            What’s going wrong?
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-pretty text-ink-2 sm:text-base">
            Describe the problem in your own words. PocketOps finds likely causes, walks you through the fix step by step,
            and flags safety risks — even without a connection.
          </p>
        </motion.header>

        <AnimatePresence mode="wait" initial={false}>
          {phase.kind === 'running' ? (
            <Analyzing key="run" problem={text.trim()} route={phase.route} onCancel={() => abort.current?.abort()} />
          ) : phase.kind === 'fallback' ? (
            <motion.div key="fb" exit={{ opacity: 0 }}>
              <OfflineFallback problem={text.trim()} reason={phase.reason} onBack={back} />
            </motion.div>
          ) : phase.kind === 'error' ? (
            <motion.div key="err" exit={{ opacity: 0 }}>
              <ErrorPanel message={phase.message} onRetry={submit} onBack={back} />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
              className="space-y-9"
            >
              <Composer ref={composer} value={text} onChange={setText} category={category} onCategory={setCategory} onSubmit={submit} />

              <section aria-labelledby="examples">
                <h2 id="examples" className="label mb-3">
                  Try an example
                </h2>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {EXAMPLE_PROMPTS.map((ex, i) => {
                    const cat = categoryById(ex.category);
                    const Icon = cat.icon;
                    return (
                      <motion.button
                        key={ex.text}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + i * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
                        onClick={() => {
                          setText(ex.text);
                          setCategory(ex.category);
                          composer.current?.focus();
                        }}
                        className="group card flex items-start gap-3 p-3.5 text-left transition duration-200 hover:-translate-y-px hover:border-line-strong"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2 transition group-hover:text-local">
                          <Icon className="size-4" strokeWidth={1.8} />
                        </span>
                        <span className="flex-1 text-[13.5px] leading-snug text-ink-2 transition group-hover:text-ink">{ex.text}</span>
                        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-ink-3 opacity-0 transition group-hover:opacity-100" />
                      </motion.button>
                    );
                  })}
                </div>
              </section>

              {recent.length > 0 && (
                <section aria-labelledby="recent">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 id="recent" className="label">
                      Recent on this device
                    </h2>
                    <Link to="/saved" className="flex items-center gap-1 text-[12.5px] text-ink-3 transition hover:text-ink">
                      View all <ArrowRight className="size-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {recent.map((s) => (
                      <SessionCard key={s.id} s={s} dense />
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="hidden space-y-4 lg:block">
        <div className="sticky top-12 space-y-4">
          <RoutingMatrix problemLength={text.trim().length} />
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <span
                className={cx(
                  'grid size-8 shrink-0 place-items-center rounded-lg',
                  engine.route.target === 'on-device' ? 'bg-local/12 text-local' : 'bg-surface-2 text-ink-2',
                )}
              >
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-[13.5px] font-medium">Private by default</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                  When Gemini Nano is ready, your problem is processed on this device and never sent to the cloud. Every
                  answer is labelled with where it came from.
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
