import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Cloud,
  Cpu,
  HardHat,
  Lightbulb,
  ListChecks,
  Loader2,
  PartyPopper,
  Search,
  Share2,
  Sparkles,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../components/Dialog';
import { LikelihoodMeter, SectionTitle, SeverityBadge, SourceBadge, cx } from '../components/ui';
import { Analyzing } from '../components/Analyzing';
import { cloudLabel, planRoute, runDiagnosis, sessionFromResult, type Depth, type Route } from '../engine';
import { categoryById } from '../lib/categories';
import { deleteSession, putSession } from '../lib/db';
import { formatDuration, relativeTime } from '../lib/format';
import type { EngineMode, Session } from '../lib/types';
import { useSession, useSessions } from '../lib/useSessions';
import { getRuntimeConfig } from '../lib/remoteConfig';
import { useEngine } from '../state/engine';
import { useToast } from '../state/toast';

const container: Variants = { show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
};

function toPlainText(s: Session) {
  const sol = s.solution;
  const lines = [
    sol.title,
    '',
    `Problem: ${s.problem}`,
    '',
    sol.summary,
    '',
    'Possible causes:',
    ...sol.causes.map((c, i) => `${i + 1}. ${c.title} (${c.likelihood}) — ${c.detail}`),
    '',
    'Steps:',
    ...sol.steps.map((st, i) => `${i + 1}. ${st.title}${st.detail ? ` — ${st.detail}` : ''}`),
  ];
  if (sol.safety.length) lines.push('', 'Safety:', ...sol.safety.map((x) => `• ${x}`));
  if (sol.ifNotResolved.length) lines.push('', 'If not resolved:', ...sol.ifNotResolved.map((x) => `• ${x}`));
  lines.push('', `— PocketOps AI (${s.source === 'on-device' ? 'on-device' : s.source === 'cloud' ? 'cloud' : 'example'} · ${s.model})`);
  return lines.join('\n');
}

export default function SessionDetail() {
  const { id } = useParams();
  const session = useSession(id);
  const navigate = useNavigate();
  const fresh = Boolean((useLocation().state as { fresh?: boolean } | null)?.fresh);
  const { push } = useToast();
  const engine = useEngine();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [regen, setRegen] = useState<{ depth: Depth; route: Route } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const toasted = useRef(false);
  const { sessions } = useSessions();

  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (fresh && session && !toasted.current) {
      toasted.current = true;
      push({ tone: 'success', title: 'Saved to this device', body: 'Available offline from Saved anytime.' });
    }
  }, [fresh, session, push]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id]);

  if (session === undefined) return <DetailSkeleton />;
  if (session === null)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface text-ink-3">
          <Search className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold">Guide not found</h1>
        <p className="mt-1 text-sm text-ink-2">It may have been deleted from this device.</p>
        <Link to="/saved" className="btn-secondary mt-6">
          <ArrowLeft className="size-4" /> Back to saved
        </Link>
      </div>
    );

  const sol = session.solution;
  const cat = categoryById(session.category);
  const CatIcon = cat.icon;
  const done = new Set(session.completedSteps);
  const total = sol.steps.length;
  const progress = total ? done.size / total : 0;
  const resolved = total > 0 && done.size === total;

  const toggleStep = (i: number) => {
    const next = new Set(done);
    next.has(i) ? next.delete(i) : next.add(i);
    putSession({ ...session, completedSteps: [...next].sort((a, b) => a - b) });
    if (next.size === total && !done.has(i)) push({ tone: 'success', title: 'All steps complete', body: 'Nice work. Hopefully that did it.' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(session));
      push({ tone: 'success', title: 'Copied to clipboard' });
    } catch {
      push({ tone: 'error', title: 'Couldn’t access the clipboard' });
    }
  };

  const share = async () => {
    const text = toPlainText(session);
    if (navigator.share) {
      try {
        await navigator.share({ title: sol.title, text });
      } catch {
        /* user cancelled */
      }
    } else copy();
  };

  const canLocal = engine.local === 'available';
  const canCloud = engine.online;

  const deepChild = sessions.find((x) => x.parentId === session.id && x.depth === 'deep');
  const parent = session.parentId ? sessions.find((x) => x.id === session.parentId) : undefined;
  const isDeep = session.depth === 'deep';

  /** Quick on-device re-run, or a deep analysis handed to cloud Gemini (ONLY_IN_CLOUD). */
  const regenerate = async (depth: Depth) => {
    const mode: EngineMode = depth === 'deep' ? engine.mode : 'local-only';
    const snap = { online: engine.online, local: engine.local, mode };
    const route = planRoute(snap, { depth, problemLength: session.problem.length });
    if (route.target === 'none') return push({ tone: 'error', title: 'Not available right now', body: route.reason });
    const ac = new AbortController();
    abort.current = ac;
    setRegen({ depth, route });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const r = await runDiagnosis(session.problem, session.category, snap, { depth, signal: ac.signal });
      const next = sessionFromResult(session.problem, r, depth === 'deep' ? { parentId: session.id } : {});
      await putSession(next);
      navigate(`/s/${next.id}`, { state: { fresh: true } });
    } catch (e) {
      if (!ac.signal.aborted)
        push({
          tone: 'error',
          title: depth === 'deep' ? 'Deep analysis failed' : 'Couldn’t regenerate',
          body: e instanceof Error ? e.message : undefined,
        });
    } finally {
      setRegen(null);
    }
  };

  return (
    <motion.div
      key={session.id}
      variants={container}
      initial={fresh ? 'hidden' : false}
      animate="show"
      className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:px-10 lg:py-10"
    >
      <article className="min-w-0 space-y-8">
        <AnimatePresence>
          {regen && (
            <motion.div key="regen" exit={{ opacity: 0, height: 0 }}>
              <p className="label mb-3">{regen.depth === 'deep' ? 'Running deep analysis' : 'Re-running on-device'}</p>
              <Analyzing problem={session.problem} route={regen.route} onCancel={() => abort.current?.abort()} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div variants={item}>
          <Link to="/saved" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-3 transition hover:text-ink">
            <ArrowLeft className="size-3.5" /> Saved guides
          </Link>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SourceBadge source={session.source} model={session.model} />
            <SeverityBadge severity={sol.severity} />
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs text-ink-2">
              <CatIcon className="size-3.5" /> {cat.label}
            </span>
            {isDeep && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-cloud/10 px-2.5 text-xs font-medium text-cloud">
                <Sparkles className="size-3.5" /> Deep analysis
              </span>
            )}
          </div>
          <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[36px]">{sol.title}</h1>
          <p className="mt-2 font-mono text-[11.5px] text-ink-3">
            {relativeTime(session.createdAt)}
            {!session.sample && <> · generated in {formatDuration(session.durationMs)}</>}
            {session.inferenceMode && <> · Firebase AI Logic · {session.inferenceMode.toUpperCase()}</>}
          </p>
          {parent && (
            <Link
              to={`/s/${parent.id}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-2 transition hover:text-ink"
            >
              <ArrowLeft className="size-3.5" /> Expands on the quick triage ({parent.source === 'on-device' ? 'on-device' : 'cloud'})
            </Link>
          )}
          <blockquote className="mt-5 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
            <span className="label mb-1 block">You described</span>
            {session.problem}
          </blockquote>
          {sol.summary && <p className="mt-5 text-[16px] leading-relaxed text-pretty text-ink">{sol.summary}</p>}
        </motion.div>

        {!isDeep && (
          <motion.div variants={item}>
            {deepChild ? (
              <Link
                to={`/s/${deepChild.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-cloud/25 bg-cloud/[0.06] p-4 transition hover:border-cloud/45"
              >
                <Sparkles className="size-5 shrink-0 text-cloud" />
                <span className="flex-1 text-[14px] text-ink">
                  Deep analysis available <span className="text-ink-3">· {deepChild.model}</span>
                </span>
                <ArrowLeft className="size-4 rotate-180 text-cloud transition group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-cloud/25 bg-cloud/[0.06] p-4 sm:flex-row sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cloud/12 text-cloud">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium">Need more than a quick triage?</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">
                    Deep analysis hands this problem to {cloudLabel(getRuntimeConfig().deepModel)} for confirming tests, more detailed steps and what to tell a
                    technician.
                  </p>
                </div>
                <button
                  onClick={() => regenerate('deep')}
                  disabled={!engine.online || !!regen}
                  className="btn h-9 shrink-0 bg-cloud px-3.5 font-semibold text-canvas hover:opacity-90"
                >
                  {regen?.depth === 'deep' ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
                  {engine.online ? 'Deep analysis' : 'Needs internet'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Mobile progress + actions */}
        <motion.div variants={item} className="lg:hidden">
          <ProgressCard done={done.size} total={total} progress={progress} resolved={resolved} />
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            <button onClick={share} className="btn-secondary h-9 shrink-0 text-[13px]">
              <Share2 className="size-3.5" /> Share
            </button>
            <button onClick={copy} className="btn-secondary h-9 shrink-0 text-[13px]">
              <ClipboardCopy className="size-3.5" /> Copy
            </button>
            {canLocal && (
              <button onClick={() => regenerate('quick')} disabled={!!regen} className="btn-secondary h-9 shrink-0 text-[13px]">
                <Cpu className="size-3.5" /> Re-run on-device
              </button>
            )}
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete guide"
              className="btn-secondary ml-auto size-9 shrink-0 !px-0 text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </motion.div>

        {sol.safety.length > 0 && (
          <motion.section variants={item} aria-labelledby="safety">
            <div className="relative overflow-hidden rounded-2xl border border-warn/30 bg-warn/[0.06] p-5">
              <div className="absolute inset-y-0 left-0 w-1 bg-warn" />
              <h2 id="safety" className="flex items-center gap-2 text-[15px] font-semibold text-warn">
                <ShieldAlert className="size-4.5" /> Before you start — safety
              </h2>
              <ul className="mt-3 space-y-2">
                {sol.safety.map((x) => (
                  <li key={x} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
                    <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-warn" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}

        {sol.causes.length > 0 && (
          <motion.section variants={item} aria-labelledby="causes">
            <SectionTitle icon={<Lightbulb className="size-3.5" />}>
              <span id="causes">Possible causes</span>
            </SectionTitle>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {sol.causes.map((c, i) => (
                <div key={c.title} className="card p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                    <LikelihoodMeter value={c.likelihood} />
                  </div>
                  <p className="text-[14.5px] font-medium tracking-tight">{c.title}</p>
                  {c.detail && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{c.detail}</p>}
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {total > 0 && (
          <motion.section variants={item} aria-labelledby="steps">
            <SectionTitle
              icon={<ListChecks className="size-3.5" />}
              aside={
                <span className="font-mono text-xs text-ink-3">
                  {done.size}/{total} done
                </span>
              }
            >
              <span id="steps">Step-by-step fix</span>
            </SectionTitle>
            <ol className="card divide-y divide-line overflow-hidden">
              {sol.steps.map((st, i) => {
                const checked = done.has(i);
                return (
                  <li key={i}>
                    <button
                      onClick={() => toggleStep(i)}
                      aria-pressed={checked}
                      className="group flex w-full gap-4 p-4 text-left transition hover:bg-surface-2/60 sm:p-5"
                    >
                      <span
                        className={cx(
                          'relative mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[11px] font-medium transition-all duration-300',
                          checked
                            ? 'border-local bg-local text-[#04140d]'
                            : 'border-line-strong text-ink-3 group-hover:border-ink-3 group-hover:text-ink',
                        )}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {checked ? (
                            <motion.span key="c" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}>
                              <Check className="size-3.5" strokeWidth={3} />
                            </motion.span>
                          ) : (
                            <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              {i + 1}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            'block text-[15px] font-medium tracking-tight transition-colors',
                            checked ? 'text-ink-3 line-through decoration-ink-3/50' : 'text-ink',
                          )}
                        >
                          {st.title}
                        </span>
                        {st.detail && (
                          <span className={cx('mt-1 block text-[13.5px] leading-relaxed transition-colors', checked ? 'text-ink-3' : 'text-ink-2')}>
                            {st.detail}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <AnimatePresence>
              {resolved && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 rounded-2xl border border-local/25 bg-local/8 p-4 text-sm">
                    <PartyPopper className="size-5 shrink-0 text-local" />
                    <span className="text-ink">
                      All steps done. If the problem persists, see the recommendations below.
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {(sol.ifNotResolved.length > 0 || sol.seekProfessional) && (
          <motion.section variants={item} aria-labelledby="next">
            <SectionTitle icon={<HardHat className="size-3.5" />}>
              <span id="next">If it’s still not resolved</span>
            </SectionTitle>
            <div className="card p-5">
              {sol.seekProfessional && (
                <p className="mb-4 flex items-start gap-2.5 rounded-xl bg-danger/8 p-3 text-[13.5px] leading-relaxed text-ink">
                  <HardHat className="mt-0.5 size-4 shrink-0 text-danger" />
                  This issue may need a qualified technician. Don’t attempt repairs beyond the safe checks above.
                </p>
              )}
              <ul className="space-y-2.5">
                {sol.ifNotResolved.map((x, i) => (
                  <li key={x} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
                    <span className="mt-0.5 font-mono text-[11px] text-ink-3">{String.fromCharCode(65 + i)}</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}

        <motion.p variants={item} className="border-t border-line pt-5 text-[12.5px] leading-relaxed text-ink-3">
          AI-generated guidance, not a professional diagnosis. Local and cloud models may give different answers. When in doubt, stop and
          consult a qualified technician.
        </motion.p>
      </article>

      {/* Desktop side rail */}
      <motion.aside variants={item} className="hidden lg:block">
        <div className="sticky top-10 space-y-3">
          <ProgressCard done={done.size} total={total} progress={progress} resolved={resolved} />
          <div className="card p-2">
            <RailButton icon={<Share2 className="size-4" />} label="Share guide" onClick={share} />
            <RailButton icon={<ClipboardCopy className="size-4" />} label="Copy as text" onClick={copy} />
            <div className="my-1 h-px bg-line" />
            <p className="label px-2.5 pt-2 pb-1">Hybrid AI</p>
            <RailButton
              icon={regen?.depth === 'quick' ? <Loader2 className="size-4 animate-spin" /> : <Cpu className="size-4" />}
              label="Re-run on-device"
              hint={canLocal ? 'Gemini Nano' : 'Not ready'}
              disabled={!canLocal || !!regen}
              onClick={() => regenerate('quick')}
            />
            <RailButton
              icon={regen?.depth === 'deep' ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              label="Deep analysis"
              hint={canCloud ? 'Cloud' : 'Offline'}
              disabled={!canCloud || !!regen || isDeep}
              onClick={() => regenerate('deep')}
            />
            <div className="my-1 h-px bg-line" />
            <RailButton icon={<Trash2 className="size-4" />} label="Delete" danger onClick={() => setConfirmDelete(true)} />
          </div>
        </div>
      </motion.aside>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this guide?"
        body="It will be permanently removed from this device and from your synced account."
        confirmLabel="Delete"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteSession(session.id);
          push({ tone: 'info', title: 'Guide deleted' });
          navigate('/saved', { replace: true });
        }}
      />
    </motion.div>
  );
}

function ProgressCard({ done, total, progress, resolved }: { done: number; total: number; progress: number; resolved: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="card flex items-center gap-4 p-4">
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="4" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--local)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - progress) }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <div>
        <p className="text-sm font-medium">{resolved ? 'All steps complete' : total ? 'Your progress' : 'No steps'}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">
          {done} of {total} steps · saved on device
        </p>
      </div>
    </div>
  );
}

function RailButton({
  icon,
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick(): void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition disabled:opacity-45',
        danger ? 'text-danger hover:bg-danger/8' : 'text-ink-2 hover:bg-surface-2 hover:text-ink disabled:hover:bg-transparent',
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="font-mono text-[10.5px] text-ink-3">{hint}</span>}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-10 sm:px-6 lg:px-10" aria-busy="true">
      <div className="skeleton h-4 w-28" />
      <div className="flex gap-2">
        <div className="skeleton h-7 w-48 !rounded-full" />
        <div className="skeleton h-7 w-28 !rounded-full" />
      </div>
      <div className="skeleton h-9 w-3/4 max-w-xl" />
      <div className="skeleton h-20 w-full max-w-3xl !rounded-xl" />
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="skeleton h-28 !rounded-2xl" />
        <div className="skeleton h-28 !rounded-2xl" />
      </div>
    </div>
  );
}
