import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Cloud,
  ClipboardCopy,
  Cpu,
  HardHat,
  Lightbulb,
  ListChecks,
  MessageCircleQuestion,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Square,
  Volume2,
  Wrench,
} from 'lucide-react';
import type { Cause, FollowUp, Question, Solution, Step } from '../lib/types';
import type { Route } from '../engine';
import { parsePartialJson } from '../engine/parse';
import { useToast } from '../state/toast';
import { Inline, Markdown } from './Markdown';
import { cx } from './ui';

// ───────────────────────── Document-style pieces ─────────────────────────

function Heading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[16.5px] font-semibold tracking-tight text-ink">
      <span className="grid size-6 place-items-center rounded-md bg-surface-2 text-ink-2">{icon}</span>
      {children}
    </h3>
  );
}

const LIKELY: Record<Cause['likelihood'], { label: string; cls: string }> = {
  high: { label: 'Most likely', cls: 'bg-local/10 text-local' },
  medium: { label: 'Possible', cls: 'bg-amber-500/12 text-amber-700 dark:text-amber-300' },
  low: { label: 'Less likely', cls: 'bg-surface-3 text-ink-3' },
};

function CauseList({ causes }: { causes: Cause[] }) {
  return (
    <ul className="space-y-3">
      {causes.map((c, i) => (
        <li key={c.title + i} className="flex gap-3">
          <span className="mt-[0.62em] size-1.5 shrink-0 rounded-full bg-ink-3" />
          <p className="text-[15px] leading-relaxed text-ink">
            <span className="font-semibold">
              <Inline text={c.title} />
            </span>
            <span className={cx('ml-2 inline-flex translate-y-[-1px] rounded-full px-2 py-0.5 align-middle text-[11px] font-medium', LIKELY[c.likelihood].cls)}>
              {LIKELY[c.likelihood].label}
            </span>
            {c.detail && (
              <span className="block text-[14.5px] text-ink-2">
                <Inline text={c.detail} />
              </span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** All fixes at once, numbered. Each can be ticked off; nothing to page through. */
function FixList({ steps, done, onToggle }: { steps: Step[]; done?: Set<number>; onToggle?(i: number): void }) {
  return (
    <ol className="space-y-4">
      {steps.map((st, i) => {
        const checked = done?.has(i) ?? false;
        return (
          <li key={i} className="flex gap-3.5">
            {onToggle ? (
              <button
                onClick={() => onToggle(i)}
                aria-pressed={checked}
                aria-label={checked ? `Mark step ${i + 1} as not done` : `Mark step ${i + 1} as done`}
                title={checked ? 'Done — click to undo' : 'Mark as done'}
                className={cx(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[11.5px] font-semibold transition',
                  checked ? 'border-local bg-local text-on-local' : 'border-line-strong text-ink-2 hover:border-local hover:text-local',
                )}
              >
                {checked ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </button>
            ) : (
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong font-mono text-[11.5px] font-semibold text-ink-2">
                {i + 1}
              </span>
            )}
            <div className={cx('min-w-0 flex-1 transition-opacity', checked && 'opacity-55')}>
              <p className={cx('text-[15px] leading-relaxed font-semibold text-ink', checked && 'line-through decoration-ink-3/60')}>
                <Inline text={st.title} />
              </p>
              {st.detail && (
                <p className="mt-0.5 text-[14.5px] leading-relaxed text-ink-2">
                  <Inline text={st.detail} />
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SafetyNote({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border-l-[3px] border-warn bg-amber-50/80 px-4 py-3 dark:bg-warn/[0.07]">
      <p className="flex items-center gap-2 text-[14.5px] font-semibold text-warn">
        <AlertTriangle className="size-4" /> Safety first
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((x) => (
          <li key={x} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink">
            <span className="mt-[0.62em] size-1.5 shrink-0 rounded-full bg-warn" />
            <span>
              <Inline text={x} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProNote() {
  return (
    <p className="flex items-start gap-2.5 rounded-xl bg-danger/[0.07] px-4 py-3 text-[14px] leading-relaxed text-ink">
      <HardHat className="mt-0.5 size-4 shrink-0 text-danger" />
      This may need a qualified technician. Don’t attempt repairs beyond the safe checks above.
    </p>
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

interface DocProps {
  answer: string;
  causes?: Cause[];
  safety?: string[];
  steps?: Step[];
  stepsTitle?: string;
  ifNotResolved?: string[];
  seekProfessional?: boolean;
  question?: Question;
  verdict?: FollowUp['verdict'];
  tools?: string[];
  done?: Set<number>;
  onToggle?(i: number): void;
  onAnswer?(text: string): void;
  answered?: boolean;
  streaming?: boolean;
}

/** One flowing, ChatGPT-style response: everything visible at once, top to bottom. */
function DocAnswer(d: DocProps) {
  const hasMore = Boolean(d.causes?.length || d.safety?.length || d.steps?.length || d.verdict || d.tools?.length);
  return (
    <div className="space-y-6">
      {(d.answer || d.streaming) && <Markdown text={d.answer} caret={d.streaming && !hasMore} />}
      {d.verdict && <Verdict v={d.verdict} />}
      {d.causes && d.causes.length > 0 && (
        <section>
          <Heading icon={<Lightbulb className="size-3.5" />}>Likely causes</Heading>
          <CauseList causes={d.causes} />
        </section>
      )}
      {d.safety && <SafetyNote items={d.safety} />}
      {d.tools && d.tools.length > 0 && <Tools tools={d.tools} />}
      {d.steps && d.steps.length > 0 && (
        <section>
          <Heading icon={<ListChecks className="size-3.5" />}>{d.stepsTitle ?? 'How to fix it'}</Heading>
          <FixList steps={d.steps} done={d.done} onToggle={d.onToggle} />
        </section>
      )}
      {d.ifNotResolved && d.ifNotResolved.length > 0 && (
        <section>
          <Heading icon={<HardHat className="size-3.5" />}>If it still doesn’t work</Heading>
          <ul className="space-y-2">
            {d.ifNotResolved.map((x) => (
              <li key={x} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                <span className="mt-[0.62em] size-1.5 shrink-0 rounded-full bg-ink-3" />
                <span>
                  <Inline text={x} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.seekProfessional && <ProNote />}
      {d.question && !d.streaming && <QuestionCard question={d.question} onAnswer={d.onAnswer} answered={d.answered} />}
      {d.streaming && hasMore && (
        <span className="inline-flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-gradient-to-r from-local to-cloud"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

interface Interactive {
  done: Set<number>;
  onToggle(i: number): void;
  onStepFailed?(i: number, step: Step): void;
  onAnswer?(text: string): void;
  answered?: boolean;
}

/** First answer to a problem. */
export function GuideAnswer({ solution: sol, done, onToggle, onAnswer, answered }: { solution: Solution } & Interactive) {
  return (
    <DocAnswer
      answer={sol.answer || sol.summary}
      causes={sol.causes}
      safety={sol.safety}
      steps={sol.steps}
      ifNotResolved={sol.ifNotResolved}
      seekProfessional={sol.seekProfessional}
      question={sol.question}
      done={done}
      onToggle={onToggle}
      onAnswer={onAnswer}
      answered={answered}
    />
  );
}

/** Follow-up answer, shaped to the question. */
export function ReplyAnswer({ reply, done, onToggle, onAnswer, answered }: { reply: FollowUp } & Interactive) {
  return (
    <DocAnswer
      answer={reply.message}
      verdict={reply.verdict}
      tools={reply.tools}
      safety={reply.safety}
      steps={reply.steps}
      stepsTitle="Try these next"
      seekProfessional={reply.seekProfessional}
      question={reply.question}
      done={done}
      onToggle={onToggle}
      onAnswer={onAnswer}
      answered={answered}
    />
  );
}

// ───────────────────────── Live streaming ─────────────────────────

const PHASES = ['Reading your message', 'Thinking it through', 'Writing the answer'];
const LIKELIHOODS = ['high', 'medium', 'low'] as const;

/** Renders the answer in the final layout while it is still being written. */
export function StreamingAnswer({ raw, route, deep, onStop }: { raw: string; route: Route; deep?: boolean; onStop(): void }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setT(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, []);
  const p = useMemo(() => (raw ? parsePartialJson(raw) : null), [raw]);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);
  const answer = (typeof p?.answer === 'string' && p.answer) || (typeof p?.message === 'string' && p.message) || '';
  const causes: Cause[] = Array.isArray(p?.causes)
    ? (p!.causes as Record<string, unknown>[])
        .filter((c) => typeof c?.title === 'string' && c.title)
        .map((c) => ({
          title: String(c.title),
          detail: typeof c.detail === 'string' ? c.detail : '',
          likelihood: LIKELIHOODS.includes(c.likelihood as never) ? (c.likelihood as Cause['likelihood']) : 'medium',
        }))
    : [];
  const steps: Step[] = Array.isArray(p?.steps)
    ? (p!.steps as Record<string, unknown>[])
        .filter((s) => typeof s?.title === 'string' && s.title)
        .map((s) => ({ title: String(s.title), detail: typeof s.detail === 'string' ? s.detail : '' }))
    : [];
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

      {answer || causes.length || steps.length ? (
        <DocAnswer
          answer={answer}
          causes={causes}
          safety={strs(p?.safety)}
          steps={steps}
          stepsTitle={typeof p?.message === 'string' || 'verdict' in (p ?? {}) ? 'Try these next' : 'How to fix it'}
          ifNotResolved={strs(p?.ifNotResolved)}
          tools={strs(p?.tools)}
          streaming
        />
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
