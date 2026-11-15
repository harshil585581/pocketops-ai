import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Cloud,
  ClipboardCopy,
  Cpu,
  HardHat,
  ListChecks,
  ListOrdered,
  MessageCircleQuestion,
  PartyPopper,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SkipForward,
  Sparkles,
  Square,
  Target,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import type { FollowUp, Question, Solution, Step } from '../lib/types';
import type { Route } from '../engine';
import { parsePartialJson } from '../engine/parse';
import { useToast } from '../state/toast';
import { Inline, Markdown } from './Markdown';
import { ProfessionalNote, SafetyCallout, StepList } from './GuideView';
import { LikelihoodMeter, cx } from './ui';

// ───────────────────────── Fix-it walkthrough ─────────────────────────

/** One step at a time, with Done / Didn't work / Skip. Switchable to the full checklist. */
export function Walkthrough({
  steps,
  done,
  onToggle,
  onStepFailed,
}: {
  steps: Step[];
  done: Set<number>;
  onToggle(i: number): void;
  onStepFailed?(i: number, step: Step): void;
}) {
  const firstOpen = () => {
    const i = steps.findIndex((_, k) => !done.has(k));
    return i === -1 ? steps.length : i;
  };
  const [cursor, setCursor] = useState(firstOpen);
  const [list, setList] = useState(false);
  const total = steps.length;
  const completed = done.size;
  const finished = cursor >= total;

  const nextOpen = (from: number) => {
    for (let k = from + 1; k < total; k++) if (!done.has(k)) return k;
    return total;
  };
  const markDone = () => {
    if (!done.has(cursor)) onToggle(cursor);
    setCursor(nextOpen(cursor));
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span className="grid size-7 place-items-center rounded-lg bg-local/12 text-local">
          <ListChecks className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-tight">Fix-it walkthrough</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-line-strong">
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-local to-cloud"
                animate={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
              />
            </span>
            <span className="shrink-0 font-mono text-[11px] text-ink-3">
              {completed}/{total}
            </span>
          </div>
        </div>
        <button onClick={() => setList((v) => !v)} className="btn-ghost h-8 shrink-0 px-2.5 text-[12.5px]">
          {list ? <Target className="size-3.5" /> : <ListOrdered className="size-3.5" />}
          {list ? 'One at a time' : 'All steps'}
        </button>
      </div>

      {list ? (
        <div className="p-2 sm:p-3">
          <StepList steps={steps} done={done} onToggle={onToggle} onStepFailed={onStepFailed} />
        </div>
      ) : finished ? (
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-local/12 text-local">
            <PartyPopper className="size-6" />
          </span>
          <p className="text-[16px] font-semibold tracking-tight">All steps done</p>
          <p className="max-w-sm text-[13.5px] text-ink-2">Let PocketOps know below whether that fixed it — or say what you’re seeing now.</p>
          <button onClick={() => setCursor(0)} className="btn-ghost mt-1 h-8 text-[12.5px]">
            <RotateCcw className="size-3.5" /> Review steps
          </button>
        </div>
      ) : (
        <motion.div key={cursor} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span
              className={cx(
                'grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[15px] font-semibold',
                done.has(cursor) ? 'bg-local text-on-local' : 'bg-ink text-canvas',
              )}
            >
              {done.has(cursor) ? <Check className="size-5" strokeWidth={3} /> : cursor + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="label">
                Step {cursor + 1} of {total}
              </p>
              <p className="mt-1 text-[18px] leading-snug font-semibold tracking-tight"><Inline text={steps[cursor].title} /></p>
              {steps[cursor].detail && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2"><Inline text={steps[cursor].detail} /></p>}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 sm:pl-14">
            <button onClick={markDone} className="btn-brand h-10 px-4">
              <Check className="size-4" strokeWidth={2.6} /> Done
            </button>
            {onStepFailed && (
              <button onClick={() => onStepFailed(cursor, steps[cursor])} className="btn-secondary h-10 text-[13.5px]">
                <X className="size-4" /> Didn’t work
              </button>
            )}
            <button onClick={() => setCursor(Math.min(cursor + 1, total))} className="btn-ghost h-10 text-[13.5px]">
              <SkipForward className="size-4" /> Skip
            </button>
            <span className="ml-auto flex gap-1">
              <button
                onClick={() => setCursor(Math.max(cursor - 1, 0))}
                disabled={cursor === 0}
                aria-label="Previous step"
                className="grid size-9 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                onClick={() => setCursor(Math.min(cursor + 1, total - 1))}
                disabled={cursor >= total - 1}
                aria-label="Next step"
                className="grid size-9 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
              >
                <ArrowRight className="size-4" />
              </button>
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ───────────────────────── Building blocks ─────────────────────────

export function QuestionCard({ question, onAnswer, answered }: { question: Question; onAnswer?(text: string): void; answered?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-cloud/25 bg-gradient-to-br from-cloud/[0.07] to-local/[0.04] p-4 sm:p-5">
      <p className="flex items-start gap-2.5 text-[15px] font-medium text-ink">
        <MessageCircleQuestion className="mt-0.5 size-4.5 shrink-0 text-cloud" />
        {question.text}
      </p>
      {answered ? (
        <p className="mt-2 pl-7 text-[12.5px] text-ink-3">Answered below</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 pl-7">
          {question.options.map((o) => (
            <button
              key={o}
              onClick={() => onAnswer?.(o)}
              disabled={!onAnswer}
              className="rounded-xl border border-line bg-surface px-3.5 py-2 text-[13.5px] font-medium text-ink shadow-card transition hover:-translate-y-px hover:border-cloud/40 hover:text-cloud disabled:opacity-60"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CauseSpotlight({ causes }: { causes: Solution['causes'] }) {
  const [open, setOpen] = useState(false);
  if (!causes.length) return null;
  const [top, ...rest] = causes;
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-local">
            <Target className="size-3.5" /> Most likely cause
          </span>
          <LikelihoodMeter value={top.likelihood} />
        </div>
        <p className="mt-2 text-[16.5px] font-semibold tracking-tight">{top.title}</p>
        {top.detail && <p className="mt-1 text-[14px] leading-relaxed text-ink-2"><Inline text={top.detail} /></p>}
      </div>
      {rest.length > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-ink-2 transition hover:bg-surface-2/60 sm:px-5"
          >
            Other possibilities <span className="font-mono text-[11px] text-ink-3">{rest.length}</span>
            <ChevronDown className={cx('ml-auto size-4 text-ink-3 transition-transform', open && 'rotate-180')} />
          </button>
          <div className={cx('grid transition-[grid-template-rows] duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <ul className="divide-y divide-line border-t border-line">
                {rest.map((c) => (
                  <li key={c.title} className="flex gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium">{c.title}</p>
                      {c.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2"><Inline text={c.detail} /></p>}
                    </div>
                    <LikelihoodMeter value={c.likelihood} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Collapsible({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-surface-2/60 sm:px-5">
        <span className="text-ink-3">{icon}</span>
        <span className="flex-1 text-[14px] font-medium">{title}</span>
        <ChevronDown className={cx('size-4 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>
      <div className={cx('grid transition-[grid-template-rows] duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="border-t border-line px-4 py-4 sm:px-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

const VERDICT = {
  safe: { icon: ShieldCheck, label: 'Safe to continue', cls: 'border-local/30 bg-local/[0.07] text-local' },
  caution: { icon: ShieldAlert, label: 'Proceed with caution', cls: 'border-amber-300 bg-amber-50/80 text-warn dark:border-warn/30 dark:bg-warn/[0.07]' },
  unsafe: { icon: ShieldX, label: 'Not safe — stop', cls: 'border-danger/30 bg-danger/[0.07] text-danger' },
} as const;

function Verdict({ v }: { v: NonNullable<FollowUp['verdict']> }) {
  const s = VERDICT[v.level];
  return (
    <div className={cx('flex gap-3 rounded-2xl border p-4', s.cls)}>
      <s.icon className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-[15px] font-semibold">{s.label}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-ink"><Inline text={v.reason} /></p>
      </div>
    </div>
  );
}

function Tools({ tools }: { tools: string[] }) {
  const [have, setHave] = useState<Set<number>>(new Set());
  return (
    <div className="card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <Wrench className="size-4 text-ink-3" /> You’ll need
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {tools.map((t, i) => {
          const on = have.has(i);
          return (
            <li key={t}>
              <button
                onClick={() => setHave((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set(s).add(i)))}
                className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition', on ? 'bg-local/8 text-ink-3 line-through' : 'hover:bg-surface-2')}
              >
                {on ? <Check className="size-4 shrink-0 text-local" strokeWidth={2.6} /> : <Square className="size-4 shrink-0 text-ink-3" />}
                {t}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ───────────────────────── Answers ─────────────────────────

interface Interactive {
  done: Set<number>;
  onToggle(i: number): void;
  onStepFailed?(i: number, step: Step): void;
  onAnswer?(text: string): void;
  answered?: boolean;
}

/** First answer to a problem: conversational lead, cause spotlight, safety, walkthrough, question. */
export function GuideAnswer({ solution: sol, done, onToggle, onStepFailed, onAnswer, answered }: { solution: Solution } & Interactive) {
  return (
    <div className="space-y-4">
      <Markdown text={sol.answer || sol.summary} />
      <CauseSpotlight causes={sol.causes} />
      <SafetyCallout items={sol.safety} />
      {sol.steps.length > 0 && <Walkthrough steps={sol.steps} done={done} onToggle={onToggle} onStepFailed={onStepFailed} />}
      {sol.question && <QuestionCard question={sol.question} onAnswer={onAnswer} answered={answered} />}
      {(sol.ifNotResolved.length > 0 || sol.seekProfessional) && (
        <Collapsible title="If it’s still not resolved" icon={<HardHat className="size-4" />}>
          {sol.seekProfessional && <ProfessionalNote />}
          <ul className="space-y-2">
            {sol.ifNotResolved.map((x, i) => (
              <li key={x} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
                <span className="mt-0.5 font-mono text-[11px] text-ink-3">{String.fromCharCode(65 + i)}</span>
                {x}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}

/** Follow-up answer, shaped to the question: verdict, tools, steps, a question back. */
export function ReplyAnswer({ reply, done, onToggle, onStepFailed, onAnswer, answered }: { reply: FollowUp } & Interactive) {
  return (
    <div className="space-y-4">
      <Markdown text={reply.message} />
      {reply.verdict && <Verdict v={reply.verdict} />}
      {reply.tools && reply.tools.length > 0 && <Tools tools={reply.tools} />}
      <SafetyCallout items={reply.safety} title="Safety for these steps" />
      {reply.steps.length > 0 && <Walkthrough steps={reply.steps} done={done} onToggle={onToggle} onStepFailed={onStepFailed} />}
      {reply.question && <QuestionCard question={reply.question} onAnswer={onAnswer} answered={answered} />}
      {reply.seekProfessional && <ProfessionalNote />}
    </div>
  );
}

// ───────────────────────── Live streaming ─────────────────────────

const PHASES = ['Reading your message', 'Thinking it through', 'Writing the answer'];

/** Renders an answer while it is still being generated. */
export function StreamingAnswer({ raw, route, deep, onStop }: { raw: string; route: Route; deep?: boolean; onStop(): void }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setT(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, []);
  const p = useMemo(() => (raw ? parsePartialJson(raw) : null), [raw]);
  const text = (typeof p?.answer === 'string' && p.answer) || (typeof p?.message === 'string' && p.message) || '';
  const causes = Array.isArray(p?.causes) ? (p!.causes as { title?: string }[]).filter((c) => c?.title) : [];
  const steps = Array.isArray(p?.steps) ? (p!.steps as { title?: string }[]).filter((s) => s?.title) : [];
  const local = route.target === 'on-device';
  const phase = PHASES[Math.min(Math.floor(t / 1600), PHASES.length - 1)];

  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium', local ? 'bg-local/10 text-local' : 'bg-cloud/10 text-cloud')}>
          {deep ? <Sparkles className="size-3" /> : local ? <Cpu className="size-3" /> : <Cloud className="size-3" />}
          {deep ? 'Deep analysis' : local ? 'On-device' : 'Cloud'} · <span className="font-mono">{route.model}</span>
        </span>
        <span className="font-mono text-[11px] text-ink-3 tabular-nums">{(t / 1000).toFixed(1)}s</span>
        <button onClick={onStop} className="btn-ghost ml-auto h-7 px-2 text-[12px]">
          <Square className="size-3 fill-current" /> Stop
        </button>
      </div>

      {text ? (
        <Markdown text={text} caret />
      ) : (
        <p className="flex items-center gap-2.5 text-[15px] text-ink-3">
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-gradient-to-r from-local to-cloud"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </span>
          {phase}…
        </p>
      )}

      {causes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-surface/70 p-4">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-local">
            <Target className="size-3.5" /> Most likely cause
          </p>
          <p className="mt-1 text-[15.5px] font-semibold tracking-tight">{causes[0].title}</p>
        </motion.div>
      )}
      {steps.length > 0 && (
        <div className="card p-4">
          <p className="label mb-2">Building your walkthrough</p>
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2.5 text-[14px] text-ink-2">
                <span className="font-mono text-[12px] text-ink-3">{i + 1}.</span> {s.title}
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Message actions ─────────────────────────

/** Copy · Read aloud (works offline via the browser's speech engine) · Regenerate. */
export function MessageActions({ text, onRegenerate, regenerateLabel }: { text: string; onRegenerate?(): void; regenerateLabel?: string }) {
  const { push } = useToast();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => {
    if (speaking) speechSynthesis.cancel();
  }, [speaking]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      push({ tone: 'success', title: 'Copied' });
    } catch {
      push({ tone: 'error', title: 'Couldn’t access the clipboard' });
    }
  };
  const speak = () => {
    if (!('speechSynthesis' in window)) return push({ tone: 'error', title: 'Read aloud isn’t supported in this browser' });
    if (speaking) {
      speechSynthesis.cancel();
      return setSpeaking(false);
    }
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
    u.rate = 1.02;
    u.onend = u.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const btn = 'inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-ink-3 transition hover:bg-surface-2 hover:text-ink';
  return (
    <div className="mt-3 flex flex-wrap items-center gap-0.5">
      <button onClick={copy} className={btn} title="Copy">
        <ClipboardCopy className="size-3.5" /> Copy
      </button>
      <button onClick={speak} className={cx(btn, speaking && 'bg-local/10 text-local')} title="Read aloud">
        {speaking ? <Square className="size-3 fill-current" /> : <Volume2 className="size-3.5" />} {speaking ? 'Stop' : 'Read aloud'}
      </button>
      {onRegenerate && (
        <button onClick={onRegenerate} className={btn} title="Generate a new answer">
          <RotateCcw className="size-3.5" /> {regenerateLabel ?? 'Regenerate'}
        </button>
      )}
    </div>
  );
}

/** Plain-text version of an answer for copy / read aloud. */
export function answerText(x: { solution?: Solution; reply?: FollowUp }): string {
  if (x.solution) {
    const s = x.solution;
    return [
      s.title,
      s.answer || s.summary,
      s.causes[0] ? `Most likely cause: ${s.causes[0].title}. ${s.causes[0].detail}` : '',
      s.safety.length ? `Safety: ${s.safety.join(' ')}` : '',
      ...s.steps.map((st, i) => `Step ${i + 1}: ${st.title}. ${st.detail}`),
    ]
      .filter(Boolean)
      .join('\n');
  }
  const r = x.reply!;
  return [
    r.message,
    r.verdict ? `${VERDICT[r.verdict.level].label}: ${r.verdict.reason}` : '',
    r.tools?.length ? `You'll need: ${r.tools.join(', ')}.` : '',
    ...r.steps.map((st, i) => `Step ${i + 1}: ${st.title}. ${st.detail}`),
  ]
    .filter(Boolean)
    .join('\n');
}
