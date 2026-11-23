import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Composer, type ComposerHandle } from '../components/Composer';
import { StreamingAnswer } from '../components/Answer';
import { ErrorPanel, OfflineFallback } from '../components/Fallback';
import { Logo } from '../components/ui';
import { EngineUnavailableError, planRoute, runDiagnosis, sessionFromResult, type Route } from '../engine';
import { detectCategory } from '../lib/categories';
import { putSession } from '../lib/db';
import { useImageAttachments } from '../lib/images';
import { ImageGrid } from '../components/Attachments';
import { useEngine } from '../state/engine';
import { useToast } from '../state/toast';

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
  const composer = useRef<ComposerHandle>(null);
  const abort = useRef<AbortController | null>(null);

  const [text, setText] = useState(readDraft);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [stream, setStream] = useState('');
  const { push } = useToast();
  const onImageError = useCallback((title: string) => push({ tone: 'error', title }), [push]);
  const photos = useImageAttachments(onImageError);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, text);
    } catch {
      /* ignore */
    }
  }, [text]);

  useEffect(() => () => abort.current?.abort(), []);

  async function submit() {
    const images = photos.images;
    const problem = text.trim() || (images.length ? `What’s wrong here? (see ${images.length === 1 ? 'photo' : 'photos'})` : '');
    if (!problem) return;
    const cat = detectCategory(problem);
    const { online, local, mode } = engine;
    const route = planRoute({ online, local, mode }, { problemLength: problem.length, images: images.length });

    if (route.target === 'none') {
      setPhase({ kind: 'fallback', reason: route.reason });
      return;
    }

    const ac = new AbortController();
    abort.current = ac;
    setStream('');
    setPhase({ kind: 'running', route });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const r = await runDiagnosis(problem, cat, { online, local, mode }, { signal: ac.signal, onText: setStream, images });
      const session = sessionFromResult(problem, r, images.length ? { images } : {});
      await putSession(session);
      setText('');
      photos.clear();
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

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col justify-center px-4 py-10 sm:px-6 lg:min-h-dvh">
      <div className="min-w-0">
        <motion.header
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          className="mb-7 text-center lg:mb-9"
        >
          <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[44px]">
            What’s going <span className="text-brand">wrong?</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-pretty text-ink-2">
            {engine.online
              ? 'Works even without signal - every fix you get is saved here, so you can search it offline.'
              : 'You’re offline, but you’re covered — describe the problem and we’ll search your saved fixes on this device.'}
          </p>
        </motion.header>

        <AnimatePresence mode="wait" initial={false}>
          {phase.kind === 'running' ? (
            <motion.div key="run" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 text-left">
              <div className="flex flex-col items-end gap-2">
                <ImageGrid images={photos.images} />
                {text.trim() && (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md border border-line bg-gradient-to-br from-local/[0.08] to-cloud/[0.08] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-ink">
                    {text.trim()}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Logo className="mt-0.5 hidden size-7 shrink-0 sm:block" />
                <div className="min-w-0 flex-1">
                  <StreamingAnswer raw={stream} route={phase.route} onStop={() => abort.current?.abort()} />
                </div>
              </div>
            </motion.div>
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
              className="space-y-4"
            >
              <Composer
                ref={composer}
                value={text}
                onChange={setText}
                onSubmit={submit}
                images={photos.images}
                imagesBusy={photos.busy}
                onAddImages={photos.add}
                onRemoveImage={photos.remove}
              />
              <p className="text-center text-[12px] text-ink-3">
                Each problem becomes a conversation — follow up in the same thread until it’s fixed.
              </p>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
