import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ArrowUp, BookMarked, Cloud, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { useEngine } from '../state/engine';
import { planRoute } from '../engine';
import { Kbd, cx } from './ui';

export interface ComposerHandle {
  focus(): void;
}

interface Props {
  value: string;
  onChange(v: string): void;
  onSubmit(): void;
}

const MIN = 8;
const MAX = 1200;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { value, onChange, onSubmit },
  ref,
) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const { online, local, mode } = useEngine();
  const route = planRoute({ online, local, mode }, { problemLength: value.trim().length });
  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus() }));

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  const ready = value.trim().length >= MIN;
  const RouteIcon = route.target === 'on-device' ? Cpu : route.target === 'cloud' ? Cloud : BookMarked;

  return (
    <motion.form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
      className="card group relative overflow-hidden transition-[box-shadow] duration-300 focus-within:shadow-pop focus-within:ring-brand"
    >
      <label htmlFor="problem" className="sr-only">
        Describe your problem
      </label>
      <textarea
        id="problem"
        ref={ta}
        value={value}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ready) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={3}
        placeholder="Describe what's happening — what you see, hear or smell, and when it started…"
        className="block min-h-[120px] w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[16px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none sm:text-[17px]"
      />

      <div className="flex items-center gap-3 border-t border-line bg-surface-2/50 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px]" title={route.reason}>
          <span
            className={cx(
              'grid size-6 shrink-0 place-items-center rounded-md',
              route.target === 'on-device' && 'bg-local/12 text-local',
              route.target === 'cloud' && 'bg-cloud/12 text-cloud',
              route.target === 'none' && 'bg-warn/12 text-warn',
            )}
          >
            <RouteIcon className="size-3.5" />
          </span>
          <span className="min-w-0 truncate text-ink-2">
            {route.target === 'none' ? (
              <>Saved guidance only</>
            ) : (
              <>
                Runs {route.target === 'on-device' ? 'on-device' : 'in cloud'}
                <span className="text-ink-3"> · </span>
                <span className="font-mono text-ink">{route.model}</span>
                {route.inferenceMode && (
                  <span className="hidden font-mono text-[11px] text-ink-3 md:inline"> · {route.inferenceMode.toUpperCase()}</span>
                )}
              </>
            )}
          </span>
        </div>
        <span className="hidden items-center gap-1 text-[11px] text-ink-3 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>↵</Kbd>
        </span>
        <button
          type="submit"
          disabled={!ready}
          className="btn-brand shrink-0"
        >
          {route.target === 'none' ? 'Search saved' : 'Diagnose'}
          <ArrowUp className="size-4" strokeWidth={2.4} />
        </button>
      </div>
    </motion.form>
  );
});
