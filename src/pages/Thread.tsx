import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUp,
  BookMarked,
  CheckCircle2,
  ClipboardCopy,
  Cloud,
  Cpu,
  Loader2,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../components/Dialog';
import { GuideView, ProfessionalNote, SafetyCallout, StepList } from '../components/GuideView';
import { Logo, SeverityBadge, SourceBadge, cx } from '../components/ui';
import {
  EngineUnavailableError,
  cloudLabel,
  guideTurn,
  planRoute,
  replyTurn,
  runDiagnosis,
  runFollowUp,
  userTurn,
  type Route,
} from '../engine';
import { categoryById } from '../lib/categories';
import { deleteSession, getSession, updateSession } from '../lib/db';
import { formatDuration, relativeTime } from '../lib/format';
import { getRuntimeConfig } from '../lib/remoteConfig';
import type { AssistantTurn, InferenceSource, Session, Step, Turn } from '../lib/types';
import { useSession } from '../lib/useSessions';
import { useEngine } from '../state/engine';
import { useToast } from '../state/toast';

const SUGGESTIONS = ['That didn’t fix it', 'Explain the steps more simply', 'What tools do I need?', 'Is it safe to keep using it?'];

function toPlainText(s: Session) {
  const sol = s.solution;
  const lines = [sol.title, '', `Problem: ${s.problem}`, '', sol.summary, '', 'Possible causes:'];
  sol.causes.forEach((c, i) => lines.push(`${i + 1}. ${c.title} (${c.likelihood}) — ${c.detail}`));
  lines.push('', 'Steps:');
  sol.steps.forEach((st, i) => lines.push(`${i + 1}. ${st.title}${st.detail ? ` — ${st.detail}` : ''}`));
  if (sol.safety.length) lines.push('', 'Safety:', ...sol.safety.map((x) => `• ${x}`));
  for (const t of s.turns ?? []) {
    if (t.role === 'user') lines.push('', `You: ${t.action === 'deep' ? 'Deep analysis' : t.text}`);
    else if (t.kind === 'reply') {
      lines.push('', `PocketOps: ${t.reply.message}`);
      t.reply.steps.forEach((st, i) => lines.push(`  ${i + 1}. ${st.title}${st.detail ? ` — ${st.detail}` : ''}`));
    } else lines.push('', `PocketOps (deep analysis): ${t.solution.summary}`);
  }
  lines.push('', '— PocketOps AI');
  return lines.join('\n');
}

type Pending = { route: Route; deep: boolean };

export default function Thread() {
  const { id } = useParams();
  const session = useSession(id);
  const navigate = useNavigate();
  const fresh = Boolean((useLocation().state as { fresh?: boolean } | null)?.fresh);
  const engine = useEngine();
  const { push } = useToast();

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const toasted = useRef(false);

  const turnCount = session?.turns?.length ?? 0;

  useEffect(() => () => abort.current?.abort(), []);
  // Keep scrolled-to content (focus, scrollIntoView) clear of the docked composer.
  useEffect(() => {
    const el = document.documentElement;
    el.style.scrollPaddingBottom = '9rem';
    return () => {
      el.style.scrollPaddingBottom = '';
    };
  }, []);
  useEffect(() => {
    setDraft('');
    setError(null);
    window.scrollTo({ top: 0 });
  }, [id]);
  useEffect(() => {
    if (fresh && session && !toasted.current) {
      toasted.current = true;
      push({ tone: 'success', title: 'Saved to this device', body: 'Find it any time in the sidebar — even offline.' });
      navigate(`/s/${session.id}`, { replace: true, state: null }); // don't re-toast on reload
    }
  }, [fresh, session, push, navigate]);
  useEffect(() => {
    if (turnCount || pending) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turnCount, pending]);

  if (session === undefined) return <ThreadSkeleton />;
  if (session === null) return <NotFound />;

  const sol = session.solution;
  const cat = categoryById(session.category);
  const CatIcon = cat.icon;
  const turns = session.turns ?? [];
  const resolved = session.status === 'resolved';
  const snap = { online: engine.online, local: engine.local, mode: engine.mode };
  const composerRoute = planRoute(snap, { problemLength: draft.trim().length });
  const hasDeep = turns.some((t) => t.role === 'assistant' && t.kind === 'guide' && t.depth === 'deep');
  const allSteps = sol.steps.length + turns.reduce((n, t) => n + (t.role === 'assistant' ? (t.kind === 'reply' ? t.reply.steps.length : t.solution.steps.length) : 0), 0);
  const doneSteps = session.completedSteps.length + turns.reduce((n, t) => n + (t.role === 'assistant' ? t.completedSteps.length : 0), 0);

  // ── Persistence helpers (always re-read so concurrent edits aren't lost) ──
  const update = (fn: (s: Session) => Session) => updateSession(session.id, fn);
  const toggleInitial = (i: number) =>
    update((s) => {
      const set = new Set(s.completedSteps);
      set.has(i) ? set.delete(i) : set.add(i);
      return { ...s, completedSteps: [...set].sort((a, b) => a - b) };
    });
  const toggleTurnStep = (turnId: string, i: number) =>
    update((s) => ({
      ...s,
      turns: (s.turns ?? []).map((t) => {
        if (t.role !== 'assistant' || t.id !== turnId) return t;
        const set = new Set(t.completedSteps);
        set.has(i) ? set.delete(i) : set.add(i);
        return { ...t, completedSteps: [...set].sort((a, b) => a - b) };
      }),
    }));
  const setStatus = (status: 'open' | 'resolved') => {
    update((s) => ({ ...s, status }));
    if (status === 'resolved') push({ tone: 'success', title: 'Marked as resolved', body: 'Nice work. The fix is saved for next time.' });
  };

  // ── Conversation ──
  async function respond(base: Session, user: Extract<Turn, { role: 'user' }>) {
    const deep = user.action === 'deep';
    const route = planRoute(snap, deep ? { depth: 'deep' } : { problemLength: user.text.length });
    if (route.target === 'none') return setError(route.reason);
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setPending({ route, deep });
    try {
      const turn: AssistantTurn = deep
        ? guideTurn(await runDiagnosis(base.problem, base.category, snap, { depth: 'deep', signal: ac.signal }))
        : replyTurn(await runFollowUp(base, user.text, snap, { signal: ac.signal }));
      await update((s) => ({ ...s, turns: [...(s.turns ?? []), turn] }));
    } catch (e) {
      if (ac.signal.aborted) setError('Stopped. Send your message again when you’re ready.');
      else setError(e instanceof EngineUnavailableError ? e.message : e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(null);
    }
  }

  async function send(text: string, action?: 'deep') {
    const t = text.trim();
    if ((!t && !action) || pending) return;
    const route = planRoute(snap, action ? { depth: 'deep' } : { problemLength: t.length });
    if (route.target === 'none') return setError(route.reason);
    const u = userTurn(action ? 'Deep analysis' : t, action);
    let before: Session | undefined;
    await updateSession(session!.id, (s) => {
      before = s;
      return { ...s, turns: [...(s.turns ?? []), u], status: 'open' };
    });
    setDraft('');
    if (before) respond(before, u);
  }

  const retry = async () => {
    const latest = await getSession(session.id);
    const last = latest?.turns?.at(-1);
    if (!latest || !last || last.role !== 'user') return setError(null);
    respond({ ...latest, turns: latest.turns!.slice(0, -1) }, last);
  };

  const stepFailed = (i: number, st: Step) => {
    setDraft(`Step ${i + 1} (“${st.title}”) didn’t work: `);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(input.current.value.length, input.current.value.length);
    });
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
    if (navigator.share) {
      try {
        await navigator.share({ title: sol.title, text: toPlainText(session) });
      } catch {
        /* cancelled */
      }
    } else copy();
  };

  const lastIsAssistant = !turns.length || turns[turns.length - 1].role === 'assistant';

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-dvh">
      {/* Thread header */}
      <header className="glass sticky top-14 z-20 border-b border-line lg:top-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <span className={cx('grid size-8 shrink-0 place-items-center rounded-lg', cat.tint)}>
            <CatIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-tight">{sol.title}</p>
            <p className="flex items-center gap-2 text-[11.5px] text-ink-3">
              {resolved ? (
                <span className="flex items-center gap-1 font-medium text-local">
                  <CheckCircle2 className="size-3" /> Resolved
                </span>
              ) : (
                <span>Open</span>
              )}
              <span>·</span>
              <span className="font-mono">
                {doneSteps}/{allSteps} steps
              </span>
              {session.sample && (
                <>
                  <span>·</span>
                  <span>Example</span>
                </>
              )}
            </p>
          </div>
          <IconButton label="Share" onClick={share}>
            <Share2 className="size-4" />
          </IconButton>
          <IconButton label="Copy as text" onClick={copy}>
            <ClipboardCopy className="size-4" />
          </IconButton>
          <IconButton label="Delete conversation" onClick={() => setConfirmDelete(true)} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </header>

      {/* Conversation */}
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 pt-6 pb-10 sm:px-6">
        <UserBubble text={session.problem} at={session.createdAt} />

        <Assistant
          source={session.source}
          model={session.model}
          durationMs={session.durationMs}
          inferenceMode={session.inferenceMode}
          at={session.createdAt}
          extra={<SeverityBadge severity={sol.severity} />}
        >
          <h1 className="mb-4 text-[24px] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-[28px]">{sol.title}</h1>
          <GuideView solution={sol} done={new Set(session.completedSteps)} onToggle={toggleInitial} onStepFailed={stepFailed} />
        </Assistant>

        {turns.map((t) =>
          t.role === 'user' ? (
            t.action === 'deep' ? (
              <div key={t.id} className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cloud/25 bg-cloud/8 px-3 py-1 text-[12px] font-medium text-cloud">
                  <Sparkles className="size-3.5" /> You asked for a deep analysis
                </span>
              </div>
            ) : (
              <UserBubble key={t.id} text={t.text} at={t.createdAt} />
            )
          ) : (
            <Assistant
              key={t.id}
              source={t.source}
              model={t.model}
              durationMs={t.durationMs}
              inferenceMode={t.inferenceMode}
              at={t.createdAt}
              extra={
                t.kind === 'guide' && t.depth === 'deep' ? (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-cloud/10 px-2 text-[11.5px] font-medium text-cloud">
                    <Sparkles className="size-3" /> Deep analysis
                  </span>
                ) : undefined
              }
            >
              {t.kind === 'guide' ? (
                <GuideView solution={t.solution} done={new Set(t.completedSteps)} onToggle={(i) => toggleTurnStep(t.id, i)} onStepFailed={stepFailed} />
              ) : (
                <div className="space-y-4">
                  <p className="text-[15.5px] leading-relaxed whitespace-pre-line text-ink">{t.reply.message}</p>
                  <SafetyCallout items={t.reply.safety} title="Safety for these steps" />
                  {t.reply.steps.length > 0 && (
                    <StepList
                      steps={t.reply.steps}
                      done={new Set(t.completedSteps)}
                      onToggle={(i) => toggleTurnStep(t.id, i)}
                      onStepFailed={stepFailed}
                    />
                  )}
                  {t.reply.seekProfessional && <ProfessionalNote />}
                </div>
              )}
            </Assistant>
          ),
        )}

        <AnimatePresence>
          {pending && (
            <motion.div key="thinking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Thinking route={pending.route} deep={pending.deep} onCancel={() => abort.current?.abort()} />
            </motion.div>
          )}
        </AnimatePresence>

        {error && !pending && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger/[0.06] p-4">
            <span className="flex-1 text-[14px] leading-relaxed text-ink">{error}</span>
            {!lastIsAssistant && (
              <button onClick={retry} className="btn-secondary h-8 shrink-0 text-[13px]">
                <RotateCcw className="size-3.5" /> Retry
              </button>
            )}
            <button onClick={() => setError(null)} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2">
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Outcome check + next-question suggestions */}
        {!pending && lastIsAssistant && (
          <div className="space-y-3">
            {resolved ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-local/25 bg-local/8 p-4">
                <CheckCircle2 className="size-5 shrink-0 text-local" />
                <span className="flex-1 text-[14px] text-ink">Marked as resolved. You can still ask follow-up questions.</span>
                <button onClick={() => setStatus('open')} className="btn-ghost h-8 text-[13px]">
                  Reopen
                </button>
              </div>
            ) : (
              <div className="card flex flex-wrap items-center gap-3 p-4">
                <span className="flex-1 text-[14px] font-medium">Did this fix it?</span>
                <button onClick={() => setStatus('resolved')} className="btn h-9 border border-local/30 bg-local/10 px-3.5 text-[13px] text-local hover:bg-local/15">
                  <ThumbsUp className="size-3.5" /> Yes, it’s fixed
                </button>
                <button onClick={() => send('It’s still not working.')} className="btn-secondary h-9 text-[13px]" disabled={composerRoute.target === 'none'}>
                  <ThumbsDown className="size-3.5" /> Still broken
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!hasDeep && (
                <button
                  onClick={() => send('', 'deep')}
                  disabled={!engine.online}
                  className="chip !border-cloud/30 !bg-cloud/8 !text-cloud disabled:opacity-50"
                  title={engine.online ? `Hand this to ${cloudLabel(getRuntimeConfig().deepModel)}` : 'Needs internet'}
                >
                  <Sparkles className="size-3.5" /> Deep analysis
                </button>
              )}
              {SUGGESTIONS.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={composerRoute.target === 'none'} className="chip disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} className="h-px" />
      </div>

      {/* Follow-up composer */}
      <div className="pointer-events-none sticky bottom-0 z-20 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="card pointer-events-auto mx-auto flex max-w-3xl items-end gap-2 p-2 pl-4 transition-shadow focus-within:shadow-pop focus-within:ring-brand max-sm:mx-3 sm:mx-auto"
        >
          <div className="min-w-0 flex-1 py-1.5">
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = '0px';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              disabled={composerRoute.target === 'none'}
              placeholder={composerRoute.target === 'none' ? 'AI is unavailable right now — this guide stays saved here.' : 'Tell PocketOps what happened, or ask a follow-up…'}
              aria-label="Follow-up message"
              className="block max-h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none disabled:cursor-not-allowed"
            />
            <RouteHint route={composerRoute} />
          </div>
          <button type="submit" aria-label="Send" disabled={!draft.trim() || !!pending || composerRoute.target === 'none'} className="btn-brand size-10 shrink-0 !px-0">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4.5" strokeWidth={2.4} />}
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this conversation?"
        body="It will be permanently removed from this device and from your synced account."
        confirmLabel="Delete"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteSession(session.id);
          push({ tone: 'info', title: 'Conversation deleted' });
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}

function RouteHint({ route }: { route: Route }) {
  if (route.target === 'none') return null;
  const Icon = route.target === 'on-device' ? Cpu : Cloud;
  return (
    <span className={cx('mt-1 flex items-center gap-1 text-[11px]', route.target === 'on-device' ? 'text-local' : 'text-cloud')}>
      <Icon className="size-3" />
      {route.target === 'on-device' ? 'On-device' : 'Cloud'} · <span className="font-mono">{route.model}</span>
    </span>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick(): void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx('grid size-8 shrink-0 place-items-center rounded-lg transition', danger ? 'text-ink-3 hover:bg-danger/8 hover:text-danger' : 'text-ink-3 hover:bg-surface-2 hover:text-ink')}
    >
      {children}
    </button>
  );
}

function UserBubble({ text, at }: { text: string; at: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line bg-gradient-to-br from-local/[0.08] to-cloud/[0.08] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-ink">
        {text}
      </div>
      <span className="pr-1 text-[11px] text-ink-3">{relativeTime(at)}</span>
    </motion.div>
  );
}

function Assistant({
  source,
  model,
  durationMs,
  inferenceMode,
  at,
  extra,
  children,
}: {
  source: InferenceSource;
  model: string;
  durationMs: number;
  inferenceMode?: string;
  at: number;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <Logo className="mt-0.5 hidden size-7 shrink-0 sm:block" />
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SourceBadge source={source} model={model} size="sm" />
          {extra}
          <span className="font-mono text-[10.5px] text-ink-3">
            {relativeTime(at)}
            {durationMs > 0 && ` · ${formatDuration(durationMs)}`}
            {inferenceMode && ` · ${inferenceMode.toUpperCase()}`}
          </span>
        </div>
        {children}
      </div>
    </motion.div>
  );
}

const STAGES = ['Reading your message', 'Checking what you’ve tried', 'Working out next steps', 'Checking safety'];

function Thinking({ route, deep, onCancel }: { route: Route; deep: boolean; onCancel(): void }) {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const a = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 1400);
    const b = setInterval(() => setT(performance.now() - t0), 100);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  const local = route.target === 'on-device';
  return (
    <div className="flex gap-3" aria-live="polite" aria-busy="true">
      <Logo className="mt-0.5 hidden size-7 shrink-0 sm:block" />
      <div className="card relative min-w-0 flex-1 overflow-hidden p-4">
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-line">
          <div className="scan" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium', local ? 'bg-local/10 text-local' : 'bg-cloud/10 text-cloud')}>
            {local ? <Cpu className="size-3" /> : <Cloud className="size-3" />}
            {deep ? 'Deep analysis' : local ? 'On-device' : 'Cloud'} · <span className="font-mono">{route.model}</span>
          </span>
          <span className="font-mono text-[11px] text-ink-3 tabular-nums">{(t / 1000).toFixed(1)}s</span>
          <button onClick={onCancel} className="btn-ghost ml-auto h-7 px-2 text-[12px]">
            <X className="size-3.5" /> Stop
          </button>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-2">
          <Loader2 className="size-4 animate-spin text-ink-3" />
          {deep ? 'Running a deeper analysis…' : STAGES[i] + '…'}
        </p>
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true">
      <div className="ml-auto h-12 w-2/3 skeleton !rounded-2xl" />
      <div className="skeleton h-6 w-48 !rounded-full" />
      <div className="skeleton h-8 w-3/4" />
      <div className="skeleton h-24 w-full !rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="skeleton h-28 !rounded-2xl" />
        <div className="skeleton h-28 !rounded-2xl" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface text-ink-3">
        <Search className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold">Conversation not found</h1>
      <p className="mt-1 text-sm text-ink-2">It may have been deleted from this device.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/" className="btn-primary">
          <ArrowLeft className="size-4" /> New diagnosis
        </Link>
        <Link to="/saved" className="btn-secondary">
          <BookMarked className="size-4" /> All guides
        </Link>
      </div>
    </div>
  );
}
