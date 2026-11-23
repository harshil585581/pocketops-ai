import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowUp, BookMarked, Cloud, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { useEngine } from '../state/engine';
import { planRoute } from '../engine';
import { imageFiles } from '../lib/images';
import { AttachButton, AttachmentTray } from './Attachments';
import { Kbd, cx } from './ui';

export interface ComposerHandle {
  focus(): void;
}

interface Props {
  value: string;
  onChange(v: string): void;
  onSubmit(): void;
  images: string[];
  imagesBusy?: boolean;
  onAddImages(files: File[]): void;
  onRemoveImage(i: number): void;
}

const MIN = 8;
const MAX = 1200;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { value, onChange, onSubmit, images, imagesBusy, onAddImages, onRemoveImage },
  ref,
) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const { online, local, mode } = useEngine();
  const route = planRoute({ online, local, mode }, { problemLength: value.trim().length, images: images.length });
  useImperativeHandle(ref, () => ({ focus: () => ta.current?.focus() }));

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [value]);

  // A photo on its own is enough to start, like in ChatGPT or Gemini.
  const ready = (value.trim().length >= MIN || images.length > 0) && !imagesBusy;
  const RouteIcon = route.target === 'on-device' ? Cpu : route.target === 'cloud' ? Cloud : BookMarked;

  return (
    <motion.form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit();
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onAddImages(imageFiles(e.dataTransfer.files));
      }}
      className={cx(
        'card group relative overflow-hidden transition-[box-shadow] duration-300 focus-within:shadow-pop focus-within:ring-brand',
        dragging && 'ring-brand shadow-pop',
      )}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-surface/85 text-[14px] font-medium text-brand backdrop-blur-sm">
          Drop photos to attach
        </div>
      )}
      <label htmlFor="problem" className="sr-only">
        Describe your problem
      </label>
      <textarea
        id="problem"
        ref={ta}
        value={value}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const files = imageFiles(e.clipboardData.items);
          if (!files.length) return;
          e.preventDefault();
          onAddImages(files);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ready) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={3}
        placeholder={
          images.length
            ? 'Add details (optional) — what’s wrong, and when it started…'
            : 'Describe what’s happening — what you see, hear or smell, and when it started… or add a photo'
        }
        className="block min-h-[120px] w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[16px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none sm:text-[17px]"
      />
      <AttachmentTray images={images} onRemove={onRemoveImage} className="px-5 pb-3" />

      <div className="flex items-center gap-3 border-t border-line bg-surface-2/50 px-4 py-3">
        <AttachButton count={images.length} busy={imagesBusy} onFiles={onAddImages} className="-ml-1.5" />
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
