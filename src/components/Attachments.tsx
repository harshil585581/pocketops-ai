import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { MAX_IMAGES } from '../lib/images';
import { cx } from './ui';

/** "Add photo" button. On phones the picker also offers the camera. */
export function AttachButton({
  count,
  busy,
  disabled,
  onFiles,
  className,
}: {
  count: number;
  busy?: boolean;
  disabled?: boolean;
  onFiles(files: File[]): void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const full = count >= MAX_IMAGES;
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled || full || busy}
        aria-label="Add photo"
        title={full ? `Up to ${MAX_IMAGES} photos` : 'Add photo'}
        className={cx(
          'grid size-9 shrink-0 place-items-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
      >
        {busy ? <Loader2 className="size-4.5 animate-spin" /> : <ImagePlus className="size-4.5" />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Thumbnails of photos waiting to be sent. */
export function AttachmentTray({ images, onRemove, className }: { images: string[]; onRemove(i: number): void; className?: string }) {
  if (!images.length) return null;
  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      <AnimatePresence initial={false}>
        {images.map((src, i) => (
          <motion.div
            key={src.slice(-32) + i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group relative size-16 overflow-hidden rounded-xl border border-line bg-surface-2"
          >
            <img src={src} alt={`Attached photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black/85"
            >
              <X className="size-3" strokeWidth={2.6} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Photos inside a sent message. Tapping one opens it full screen. */
export function ImageGrid({ images, className }: { images: string[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (!images.length) return null;
  return (
    <>
      <div className={cx('flex flex-wrap justify-end gap-2', className)}>
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(src)}
            aria-label={`View photo ${i + 1}`}
            className={cx(
              'overflow-hidden rounded-2xl border border-line bg-surface-2 transition hover:opacity-90',
              images.length === 1 ? 'max-h-72 max-w-[min(18rem,85%)]' : 'size-28 sm:size-32',
            )}
          >
            <img src={src} alt={`Photo ${i + 1}`} className={cx('size-full', images.length === 1 ? 'max-h-72 object-contain' : 'object-cover')} />
          </button>
        ))}
      </div>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Photo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(null)}
              className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
            >
              <img src={open} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="size-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
