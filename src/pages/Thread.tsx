import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
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
import { AttachButton, AttachmentTray, ImageGrid } from '../components/Attachments';
import { ConfirmDialog } from '../components/Dialog';
import { GuideAnswer, MessageActions, ReplyAnswer, StreamingAnswer, answerText } from '../components/Answer';
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
import { imageFiles, useImageAttachments } from '../lib/images';
import { getRuntimeConfig } from '../lib/remoteConfig';
import type { AssistantTurn, InferenceSource, Session, Step, Turn } from '../lib/types';
import { useSession } from '../lib/useSessions';
import { useEngine } from '../state/engine';
import { useToast } from '../state/toast';

const SUGGESTIONS = ['That didn’t fix it', 'Explain the steps more simply', 'What tools do I need?', 'Is it safe to keep using it?'];

function toPlainText(s: Session) {
  const sol = s.solution;
  const photos = (n?: number) => (n ? ` [${n} photo${n > 1 ? 's' : ''}]` : '');
  const lines = [sol.title, '', `Problem: ${s.problem}${photos(s.images?.length)}`, '', sol.summary, '', 'Possible causes:'];
  sol.causes.forEach((c, i) => lines.push(`${i + 1}. ${c.title} (${c.likelihood}) — ${c.detail}`));
  lines.push('', 'Steps:');
  sol.steps.forEach((st, i) => lines.push(`${i + 1}. ${st.title}${st.detail ? ` — ${st.detail}` : ''}`));
  if (sol.safety.length) lines.push('', 'Safety:', ...sol.safety.map((x) => `• ${x}`));
  for (const t of s.turns ?? []) {
    if (t.role === 'user') lines.push('', `You: ${t.action === 'deep' ? 'Deep analysis' : t.text}${photos(t.images?.length)}`.trimEnd());
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
  const [stream, setStream] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragging, setDragging] = useState(false);
  const onImageError = useCallback((title: string) => push({ tone: 'error', title }), [push]);
  const photos = useImageAttachments(onImageError);
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
    photos.clear();
    setError(null);
    window.scrollTo({ top: 0 });
  }, [id, photos.clear]);
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
  useEffect(() => {
    if (!stream) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 320;
    if (nearBottom) bottom.current?.scrollIntoView({ block: 'end' });
  }, [stream]);

  if (session === undefined) return <ThreadSkeleton />;
  if (session === null) return <NotFound />;

  const sol = session.solution;
  const cat = categoryById(session.category);
  const CatIcon = cat.icon;
  const turns = session.turns ?? [];
  const resolved = session.status === 'resolved';
  const snap = { online: engine.online, local: engine.local, mode: engine.mode };
  const composerRoute = planRoute(snap, { problemLength: draft.trim().length, images: photos.images.length });
  const hasDeep = turns.some((t) => t.role === 'assistant' && t.kind === 'guide' && t.depth === 'deep');

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
    const route = planRoute(snap, deep ? { depth: 'deep' } : { problemLength: user.text.length, images: user.images?.length });
    if (route.target === 'none') return setError(route.reason);
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setStream('');
    setPending({ route, deep });
    try {
      const turn: AssistantTurn = deep
        ? guideTurn(await runDiagnosis(base.problem, base.category, snap, { depth: 'deep', signal: ac.signal, onText: setStream, images: base.images }))
        : replyTurn(await runFollowUp(base, user.text, snap, { signal: ac.signal, onText: setStream, images: user.images }));
      await update((s) => ({ ...s, turns: [...(s.turns ?? []), turn] }));
    } catch (e) {
      if (ac.signal.aborted) setError('Stopped. Send your message again when you’re ready.');
      else setError(e instanceof EngineUnavailableError ? e.message : e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(null);
      setStream('');
    }
  }

  async function send(text: string, action?: 'deep', images: string[] = []) {
    const t = text.trim();
    if ((!t && !action && !images.length) || pending || photos.busy) return;
    const route = planRoute(snap, action ? { depth: 'deep' } : { problemLength: t.length, images: images.length });
    if (route.target === 'none') return setError(route.reason);
    const u = userTurn(action ? 'Deep analysis' : t, action, action ? undefined : images);
    let before: Session | undefined;
    await updateSession(session!.id, (s) => {
      before = s;
      return { ...s, turns: [...(s.turns ?? []), u], status: 'open' };
    });
    setDraft('');
    if (images.length) photos.clear();
    if (before) respond(before, u);
  }

  const retry = async () => {
    const latest = await getSession(session.id);
    const last = latest?.turns?.at(-1);
    if (!latest || !last || last.role !== 'user') return setError(null);
    respond({ ...latest, turns: latest.turns!.slice(0, -1) }, last);
  };

  /** Replace the latest answer with a fresh one. */
  const regenerateLast = async () => {
    const latest = await getSession(session.id);
    const ts = latest?.turns ?? [];
    const last = ts.at(-1);
    const prevUser = ts.at(-2);
    if (!latest || last?.role !== 'assistant' || prevUser?.role !== 'user') return;
    await update((s) => ({ ...s, turns: (s.turns ?? []).slice(0, -1) }));
    respond({ ...latest, turns: ts.slice(0, -2) }, prevUser);
  };

  /** Regenerate the very first guide (only while it is the only answer). */
  const regenerateInitial = async () => {
    const route = planRoute(snap, { problemLength: session.problem.length, images: session.images?.length });
    if (route.target === 'none') return setError(route.reason);
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setStream('');
    setPending({ route, deep: false });
    try {
      const r = await runDiagnosis(session.problem, session.category, snap, { signal: ac.signal, onText: setStream, images: session.images });
      await update((s) => ({
        ...s,
        solution: r.solution,
        source: r.source,
        model: r.model,
        durationMs: r.durationMs,
        inferenceMode: r.inferenceMode,
        completedSteps: [],
      }));
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPending(null);
      setStream('');
    }
  };

  const answerQuestion = (question: string, option: string) => send(`${option} — re: “${question}”`);

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
  const lastAnswer = [...turns].reverse().find((t): t is AssistantTurn => t.role === 'assistant');
  const modelSuggestions = lastAnswer ? (lastAnswer.kind === 'reply' ? lastAnswer.reply.suggestions : lastAnswer.solution.suggestions) : sol.suggestions;
  const suggestions = modelSuggestions?.length ? modelSuggestions : SUGGESTIONS;

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
        <UserBubble text={session.problem} images={session.images} at={session.createdAt} />

        <Assistant
          source={session.source}
          model={session.model}
          durationMs={session.durationMs}
          inferenceMode={session.inferenceMode}
          at={session.createdAt}
          extra={<SeverityBadge severity={sol.severity} />}
        >
          <h1 className="mb-3 text-[22px] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-[26px]">{sol.title}</h1>
          <GuideAnswer
            solution={sol}
            done={new Set(session.completedSteps)}
            onToggle={toggleInitial}
            onStepFailed={stepFailed}
            onAnswer={sol.question ? (o) => answerQuestion(sol.question!.text, o) : undefined}
            answered={turns.length > 0}
          />
          <MessageActions text={answerText({ solution: sol })} onRegenerate={!turns.length && !pending ? regenerateInitial : undefined} />
        </Assistant>

        {turns.map((t, idx) =>
          t.role === 'user' ? (
            t.action === 'deep' ? (
              <div key={t.id} className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cloud/25 bg-cloud/8 px-3 py-1 text-[12px] font-medium text-cloud">
                  <Sparkles className="size-3.5" /> You asked for a deep analysis
                </span>
              </div>
            ) : (
              <UserBubble key={t.id} text={t.text} images={t.images} at={t.createdAt} />
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
                <GuideAnswer
                  solution={t.solution}
                  done={new Set(t.completedSteps)}
                  onToggle={(i) => toggleTurnStep(t.id, i)}
                  onStepFailed={stepFailed}
                  onAnswer={t.solution.question ? (o) => answerQuestion(t.solution.question!.text, o) : undefined}
                  answered={idx < turns.length - 1}
                />
              ) : (
                <ReplyAnswer
                  reply={t.reply}
                  done={new Set(t.completedSteps)}
                  onToggle={(i) => toggleTurnStep(t.id, i)}
                  onStepFailed={stepFailed}
                  onAnswer={t.reply.question ? (o) => answerQuestion(t.reply.question!.text, o) : undefined}
                  answered={idx < turns.length - 1}
                />
              )}
              <MessageActions
                text={answerText(t.kind === 'guide' ? { solution: t.solution } : { reply: t.reply })}
                onRegenerate={idx === turns.length - 1 && !pending ? regenerateLast : undefined}
              />
            </Assistant>
          ),
        )}

        <AnimatePresence>
          {pending && (
            <motion.div key="thinking" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex gap-3">
                <Logo className="mt-0.5 hidden size-7 shrink-0 sm:block" />
                <div className="min-w-0 flex-1">
                  <StreamingAnswer raw={stream} route={pending.route} deep={pending.deep} onStop={() => abort.current?.abort()} />
                </div>
              </div>
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
              {suggestions.map((q) => (
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
            send(draft, undefined, photos.images);
          }}
          onDragOver={(e) => {
            if (composerRoute.target === 'none' || !e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            photos.add(imageFiles(e.dataTransfer.files));
          }}
          className={cx(
            'card pointer-events-auto relative mx-auto flex max-w-3xl flex-wrap items-end gap-2 p-2 transition-shadow focus-within:shadow-pop focus-within:ring-brand max-sm:mx-3 sm:mx-auto',
            dragging && 'ring-brand shadow-pop',
          )}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-surface/85 text-[14px] font-medium text-brand backdrop-blur-sm">
              Drop photos to attach
            </div>
          )}
          <AttachmentTray images={photos.images} onRemove={photos.remove} className="basis-full px-2 pt-1" />
          <AttachButton
            count={photos.images.length}
            busy={photos.busy}
            disabled={composerRoute.target === 'none' && !photos.images.length}
            onFiles={photos.add}
            className="mb-0.5 size-10"
          />
          <div className="min-w-0 flex-1 py-1.5">
            <textarea
              ref={input}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = '0px';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onPaste={(e) => {
                const files = imageFiles(e.clipboardData.items);
                if (!files.length) return;
                e.preventDefault();
                photos.add(files);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft, undefined, photos.images);
                }
              }}
              rows={1}
              disabled={composerRoute.target === 'none' && !photos.images.length}
              placeholder={
                composerRoute.target === 'none'
                  ? photos.images.length
                    ? composerRoute.reason
                    : 'AI is unavailable right now — this guide stays saved here.'
                  : photos.images.length
                    ? 'Ask about the photo, or just send it…'
                    : 'Tell PocketOps what happened, or ask a follow-up…'
              }
              aria-label="Follow-up message"
              className="block max-h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none disabled:cursor-not-allowed"
            />
            <RouteHint route={composerRoute} />
          </div>
          <button
            type="submit"
            aria-label="Send"
            disabled={(!draft.trim() && !photos.images.length) || !!pending || photos.busy || composerRoute.target === 'none'}
            className="btn-brand size-10 shrink-0 !px-0"
          >
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

function UserBubble({ text, images, at }: { text: string; images?: string[]; at: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end gap-1">
      {images?.length ? <ImageGrid images={images} className="mb-1 w-full" /> : null}
      {text && (
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line bg-gradient-to-br from-local/[0.08] to-cloud/[0.08] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-ink">
          {text}
        </div>
      )}
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
        <Link to="/guide" className="btn-secondary">
          <BookOpen className="size-4" /> How it works
        </Link>
      </div>
    </div>
  );
}
