import { AnimatePresence, motion } from 'motion/react';
import { Check, HardHat, Lightbulb, ListChecks, MessageCircleQuestion, ShieldAlert } from 'lucide-react';
import type { Solution, Step } from '../lib/types';
import { LikelihoodMeter, SectionTitle, cx } from './ui';

export function SafetyCallout({ items, title = 'Before you start — safety' }: { items: string[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 dark:border-warn/30 dark:bg-warn/[0.06]">
      <div className="absolute inset-y-0 left-0 w-1 bg-warn" />
      <p className="flex items-center gap-2 text-[14.5px] font-semibold text-warn">
        <ShieldAlert className="size-4.5" /> {title}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((x) => (
          <li key={x} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
            <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-warn" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Interactive checklist. "Didn't work?" turns a failed step into a follow-up question. */
export function StepList({
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
  return (
    <ol className="card divide-y divide-line overflow-hidden">
      {steps.map((st, i) => {
        const checked = done.has(i);
        return (
          <li key={i} className="group relative">
            <button
              onClick={() => onToggle(i)}
              aria-pressed={checked}
              className="flex w-full gap-4 p-4 pr-4 text-left transition hover:bg-surface-2/60 sm:p-5 sm:pr-32"
            >
              <span
                className={cx(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[11px] font-medium transition-all duration-300',
                  checked ? 'border-local bg-local text-on-local' : 'border-line-strong text-ink-3 group-hover:border-ink-3 group-hover:text-ink',
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
                <span className={cx('block text-[15px] font-medium tracking-tight transition-colors', checked ? 'text-ink-3 line-through decoration-ink-3/50' : 'text-ink')}>
                  {st.title}
                </span>
                {st.detail && (
                  <span className={cx('mt-1 block text-[13.5px] leading-relaxed transition-colors', checked ? 'text-ink-3' : 'text-ink-2')}>{st.detail}</span>
                )}
              </span>
            </button>
            {onStepFailed && (
              <button
                onClick={() => onStepFailed(i, st)}
                className="mr-4 mb-3 ml-14 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink sm:absolute sm:top-4 sm:right-4 sm:m-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <MessageCircleQuestion className="size-3.5" /> Didn’t work?
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Full structured guide: safety first, then causes, steps and escalation. */
export function GuideView({
  solution: sol,
  done,
  onToggle,
  onStepFailed,
}: {
  solution: Solution;
  done: Set<number>;
  onToggle(i: number): void;
  onStepFailed?(i: number, step: Step): void;
}) {
  return (
    <div className="space-y-7">
      {sol.summary && <p className="text-[16px] leading-relaxed text-pretty text-ink">{sol.summary}</p>}

      <SafetyCallout items={sol.safety} />

      {sol.causes.length > 0 && (
        <section>
          <SectionTitle icon={<Lightbulb className="size-3.5" />}>Possible causes</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {sol.causes.map((c, i) => (
              <div key={c.title + i} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <LikelihoodMeter value={c.likelihood} />
                </div>
                <p className="text-[14.5px] font-medium tracking-tight">{c.title}</p>
                {c.detail && <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{c.detail}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {sol.steps.length > 0 && (
        <section>
          <SectionTitle
            icon={<ListChecks className="size-3.5" />}
            aside={
              <span className="font-mono text-xs text-ink-3">
                {done.size}/{sol.steps.length} done
              </span>
            }
          >
            Step-by-step fix
          </SectionTitle>
          <StepList steps={sol.steps} done={done} onToggle={onToggle} onStepFailed={onStepFailed} />
        </section>
      )}

      {(sol.ifNotResolved.length > 0 || sol.seekProfessional) && (
        <section>
          <SectionTitle icon={<HardHat className="size-3.5" />}>If it’s still not resolved</SectionTitle>
          <div className="card p-5">
            {sol.seekProfessional && <ProfessionalNote />}
            <ul className="space-y-2.5">
              {sol.ifNotResolved.map((x, i) => (
                <li key={x} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
                  <span className="mt-0.5 font-mono text-[11px] text-ink-3">{String.fromCharCode(65 + i)}</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

export function ProfessionalNote() {
  return (
    <p className="mb-4 flex items-start gap-2.5 rounded-xl bg-danger/8 p-3 text-[13.5px] leading-relaxed text-ink">
      <HardHat className="mt-0.5 size-4 shrink-0 text-danger" />
      This may need a qualified technician. Don’t attempt repairs beyond the safe checks above.
    </p>
  );
}
