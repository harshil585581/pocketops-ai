/**
 * Device capability checks for Chrome's built-in Gemini Nano.
 * Used only to show model status and trigger the one-time model download —
 * all inference goes through Firebase AI Logic (see ./firebase.ts).
 * Chrome manages the model itself; nothing is bundled with the app.
 */

export type LocalAvailability = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LanguageModelSession {
  destroy(): void;
}

interface LanguageModelStatic {
  availability(opts?: object): Promise<Exclude<LocalAvailability, 'unsupported'>>;
  create(opts?: object): Promise<LanguageModelSession>;
}

const LM = () => (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;

const LANG_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export const promptApiExposed = () => Boolean(LM());

export async function getLocalAvailability(): Promise<LocalAvailability> {
  const lm = LM();
  if (!lm) return 'unsupported';
  try {
    const timeout = new Promise<'unavailable'>((r) => setTimeout(() => r('unavailable'), 5000));
    return await Promise.race([lm.availability(LANG_OPTS), timeout]);
  } catch {
    return 'unavailable';
  }
}

/** Triggers (or resumes) the Gemini Nano download. Requires a user gesture and internet. */
export async function downloadLocalModel(onProgress: (fraction: number) => void): Promise<void> {
  const lm = LM();
  if (!lm) throw new Error('This browser does not expose the Prompt API.');
  const session = await lm.create({
    ...LANG_OPTS,
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (e) => onProgress((e as ProgressEvent).loaded));
    },
  });
  session.destroy();
}

export function browserInfo() {
  const ua = navigator.userAgent;
  const m = ua.match(/Chrome\/(\d+)/);
  const isEdge = /Edg\//.test(ua);
  const mobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  return {
    chromeVersion: m && !isEdge ? Number(m[1]) : null,
    isChrome: Boolean(m) && !isEdge,
    desktop: !mobile,
  };
}
