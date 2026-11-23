/**
 * Inference router. Every request runs through Firebase AI Logic; this module only decides
 * which hybrid InferenceMode to use and explains the decision to the user.
 *
 *   auto, online, Nano ready          → PREFER_ON_DEVICE  (private, fast)
 *   auto, online, Nano not ready      → PREFER_ON_DEVICE  (SDK falls back to cloud Gemini)
 *   auto, online, long description    → PREFER_IN_CLOUD   (more capable model first)
 *   auto, offline, Nano ready         → ONLY_ON_DEVICE
 *   deep analysis                     → ONLY_IN_CLOUD
 *   photos attached                   → ONLY_IN_CLOUD     (image understanding runs on cloud Gemini)
 *   local-only / cloud-only overrides → ONLY_ON_DEVICE / ONLY_IN_CLOUD
 */
import type { InferenceMode } from 'firebase/ai';
import type { AssistantTurn, CategoryId, EngineMode, FollowUp, InferenceSource, Session, Solution } from '../lib/types';
import type { LocalAvailability } from './chromeAI';
import { CloudBusyError, firebaseConfigured, generateWithFirebase } from './firebase';
import { getRuntimeConfig } from '../lib/remoteConfig';
import { buildFollowUpPrompt, buildPrompt, type Depth } from './prompt';
import { parseFollowUp, parseSolution } from './parse';

export type { Depth } from './prompt';

export interface EngineSnapshot {
  online: boolean;
  local: LocalAvailability;
  mode: EngineMode;
}

export type RouteTarget = 'on-device' | 'cloud' | 'none';

export interface Route {
  target: RouteTarget;
  /** Human label for the engine expected to answer, e.g. "Gemini Nano". */
  model: string;
  reason: string;
  /** Firebase AI Logic hybrid mode used for the request. */
  inferenceMode?: InferenceMode;
}

export interface RouteOptions {
  problemLength?: number;
  depth?: Depth;
  /** Number of photos sent with the message. */
  images?: number;
}

export const LOCAL_MODEL = 'Gemini Nano';

const QUICK_TIMEOUT_MS = 60_000;
// If the capable model is slow under load, give up after 45 s and answer with the fast model instead.
const DEEP_TIMEOUT_MS = 45_000;

export function cloudLabel(id = getRuntimeConfig().cloudModel) {
  return id
    .replace(/-latest$/, '')
    .replace(/^gemini-/, 'Gemini ')
    .replace(/-/g, ' ')
    .replace(/\b(flash|pro|lite)\b/gi, (w) => w[0].toUpperCase() + w.slice(1));
}

export function planRoute({ online, local, mode }: EngineSnapshot, opts: RouteOptions = {}): Route {
  if (!firebaseConfigured) {
    return { target: 'none', model: '', reason: 'Firebase AI Logic isn’t configured — add your Firebase web config to .env.' };
  }
  const localReady = local === 'available';
  const cloud = (reason: string, inferenceMode: InferenceMode): Route => ({ target: 'cloud', model: cloudLabel(), reason, inferenceMode });
  const device = (reason: string, inferenceMode: InferenceMode): Route => ({ target: 'on-device', model: LOCAL_MODEL, reason, inferenceMode });
  const none = (reason: string): Route => ({ target: 'none', model: '', reason });

  if (opts.depth === 'deep') {
    return online
      ? { ...cloud('Deep analysis runs on the more capable cloud model.', 'only_in_cloud'), model: cloudLabel(getRuntimeConfig().deepModel) }
      : none('Deep analysis needs an internet connection.');
  }
  if (opts.images) {
    if (mode === 'local-only') return none('Photo analysis runs on cloud Gemini — switch off On-device only, or remove the photos.');
    return online ? cloud('Photos are analysed by cloud Gemini.', 'only_in_cloud') : none('Photo analysis needs an internet connection — remove the photos to run on-device.');
  }
  if (mode === 'local-only') {
    return localReady
      ? device('On-device only — your problem never leaves this device.', 'only_on_device')
      : none('On-device only is selected, but Gemini Nano is not ready on this device.');
  }
  if (mode === 'cloud-only') {
    return online ? cloud('Cloud only — using the more capable cloud model.', 'only_in_cloud') : none('Cloud only is selected, but you are offline.');
  }
  if (!online) {
    return localReady ? device('Offline — running fully on-device.', 'only_on_device') : none('You are offline and the local model is not available.');
  }
  return cloud('Connected — using cloud Gemini.', 'prefer_in_cloud');
}

export interface DiagnosisResult {
  solution: Solution;
  category: CategoryId;
  source: InferenceSource;
  model: string;
  durationMs: number;
  depth: Depth;
  inferenceMode: InferenceMode;
}

export async function runDiagnosis(
  problem: string,
  category: CategoryId,
  snap: EngineSnapshot,
  opts: { depth?: Depth; signal?: AbortSignal; onText?: (text: string) => void; images?: string[] } = {},
): Promise<DiagnosisResult> {
  const depth = opts.depth ?? 'quick';
  const images = opts.images ?? [];
  const route = planRoute(snap, { problemLength: problem.length, depth, images: images.length });
  if (route.target === 'none' || !route.inferenceMode) throw new EngineUnavailableError(route.reason);

  const t0 = performance.now();
  const prompt = buildPrompt(problem, category, depth, getRuntimeConfig().systemInstruction, images.length);

  const cfg = getRuntimeConfig();
  const quick = { model: cfg.cloudModel, timeoutMs: QUICK_TIMEOUT_MS };
  const deep = { model: cfg.deepModel, timeoutMs: DEEP_TIMEOUT_MS };

  const attempt = async (mode: InferenceMode, cloud = depth === 'deep' ? deep : quick): Promise<DiagnosisResult> => {
    const r = await generateWithFirebase(prompt, mode, cloud, opts.signal, opts.onText, images);
    return {
      solution: parseSolution(r.text),
      category,
      source: r.source,
      model: r.source === 'on-device' ? LOCAL_MODEL : cloudLabel(cloud.model),
      durationMs: Math.round(performance.now() - t0),
      depth,
      inferenceMode: mode,
    };
  };

  try {
    return await attempt(route.inferenceMode);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    // Deep model overloaded or too slow: still give a cloud answer with the fast model.
    if (depth === 'deep' && err instanceof CloudBusyError && deep.model !== quick.model) return attempt('only_in_cloud', quick);
    // If the on-device answer couldn't be used (e.g. malformed JSON), retry in the cloud when allowed.
    const canRetryCloud = snap.online && snap.mode === 'auto' && route.inferenceMode !== 'only_in_cloud';
    if (canRetryCloud && err instanceof SyntaxError) return attempt('only_in_cloud');
    if (canRetryCloud && /structured guidance|missing causes/i.test(String(err))) return attempt('only_in_cloud');
    throw err;
  }
}

export function sessionFromResult(problem: string, r: DiagnosisResult, extra: Partial<Session> = {}): Session {
  const now = Date.now();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    updatedAt: now,
    problem,
    category: r.category,
    solution: r.solution,
    source: r.source,
    model: r.model,
    durationMs: r.durationMs,
    completedSteps: [],
    depth: r.depth,
    inferenceMode: r.inferenceMode,
    ...extra,
  };
}

export interface FollowUpResult {
  reply: FollowUp;
  source: InferenceSource;
  model: string;
  durationMs: number;
  inferenceMode: InferenceMode;
}

/** Continues a troubleshooting conversation. Routed exactly like a new diagnosis. */
export async function runFollowUp(
  session: Session,
  message: string,
  snap: EngineSnapshot,
  opts: { signal?: AbortSignal; onText?: (text: string) => void; images?: string[] } = {},
): Promise<FollowUpResult> {
  const images = opts.images ?? [];
  const route = planRoute(snap, { problemLength: message.length, images: images.length });
  if (route.target === 'none' || !route.inferenceMode) throw new EngineUnavailableError(route.reason);
  const t0 = performance.now();
  const cfg = getRuntimeConfig();
  const prompt = buildFollowUpPrompt(session, message, cfg.systemInstruction, images.length);
  const cloud = { model: cfg.cloudModel, timeoutMs: QUICK_TIMEOUT_MS, schema: 'followup' as const };

  const attempt = async (mode: InferenceMode): Promise<FollowUpResult> => {
    const r = await generateWithFirebase(prompt, mode, cloud, opts.signal, opts.onText, images);
    return {
      reply: parseFollowUp(r.text),
      source: r.source,
      model: r.source === 'on-device' ? LOCAL_MODEL : cloudLabel(cloud.model),
      durationMs: Math.round(performance.now() - t0),
      inferenceMode: mode,
    };
  };
  try {
    return await attempt(route.inferenceMode);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    const canRetryCloud = snap.online && snap.mode === 'auto' && route.inferenceMode !== 'only_in_cloud';
    if (canRetryCloud && (err instanceof SyntaxError || /structured guidance/i.test(String(err)))) return attempt('only_in_cloud');
    throw err;
  }
}

const turnId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function replyTurn(r: FollowUpResult): AssistantTurn {
  return { id: turnId(), role: 'assistant', kind: 'reply', createdAt: Date.now(), reply: r.reply, source: r.source, model: r.model, durationMs: r.durationMs, inferenceMode: r.inferenceMode, completedSteps: [] };
}

export function guideTurn(r: DiagnosisResult): AssistantTurn {
  return { id: turnId(), role: 'assistant', kind: 'guide', createdAt: Date.now(), solution: r.solution, depth: r.depth, source: r.source, model: r.model, durationMs: r.durationMs, inferenceMode: r.inferenceMode, completedSteps: [] };
}

export const userTurn = (text: string, action?: 'deep', images?: string[]) => ({
  id: turnId(),
  role: 'user' as const,
  createdAt: Date.now(),
  text,
  action,
  ...(images?.length ? { images } : {}),
});

export class EngineUnavailableError extends Error {
  name = 'EngineUnavailableError';
}
