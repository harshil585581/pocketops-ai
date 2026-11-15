/**
 * Inference router. Every request runs through Firebase AI Logic; this module only decides
 * which hybrid InferenceMode to use and explains the decision to the user.
 *
 *   auto, online, Nano ready          → PREFER_ON_DEVICE  (private, fast)
 *   auto, online, Nano not ready      → PREFER_ON_DEVICE  (SDK falls back to cloud Gemini)
 *   auto, online, long description    → PREFER_IN_CLOUD   (more capable model first)
 *   auto, offline, Nano ready         → ONLY_ON_DEVICE
 *   deep analysis                     → ONLY_IN_CLOUD
 *   local-only / cloud-only overrides → ONLY_ON_DEVICE / ONLY_IN_CLOUD
 */
import type { InferenceMode } from 'firebase/ai';
import type { CategoryId, EngineMode, InferenceSource, Session, Solution } from '../lib/types';
import type { LocalAvailability } from './chromeAI';
import { firebaseConfigured, generateWithFirebase } from './firebase';
import { getRuntimeConfig } from '../lib/remoteConfig';
import { buildPrompt, type Depth } from './prompt';
import { parseSolution } from './parse';

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
}

export const LOCAL_MODEL = 'Gemini Nano';

export function cloudLabel(id = getRuntimeConfig().cloudModel) {
  return id
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
    return online ? cloud('Deep analysis runs on cloud Gemini for more thorough reasoning.', 'only_in_cloud') : none('Deep analysis needs an internet connection.');
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
  if ((opts.problemLength ?? 0) >= getRuntimeConfig().longProblemChars) {
    return cloud('Detailed description — sent to cloud Gemini first, with on-device fallback.', 'prefer_in_cloud');
  }
  return localReady
    ? device('Gemini Nano ready — preferring private on-device inference.', 'prefer_on_device')
    : cloud('Gemini Nano not ready — Firebase AI Logic falls back to cloud Gemini.', 'prefer_on_device');
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
  opts: { depth?: Depth; signal?: AbortSignal } = {},
): Promise<DiagnosisResult> {
  const depth = opts.depth ?? 'quick';
  const route = planRoute(snap, { problemLength: problem.length, depth });
  if (route.target === 'none' || !route.inferenceMode) throw new EngineUnavailableError(route.reason);

  const t0 = performance.now();
  const prompt = buildPrompt(problem, category, depth, getRuntimeConfig().systemInstruction);

  const attempt = async (mode: InferenceMode): Promise<DiagnosisResult> => {
    const r = await generateWithFirebase(prompt, mode, opts.signal);
    return {
      solution: parseSolution(r.text),
      category,
      source: r.source,
      model: r.source === 'on-device' ? LOCAL_MODEL : cloudLabel(),
      durationMs: Math.round(performance.now() - t0),
      depth,
      inferenceMode: mode,
    };
  };

  try {
    return await attempt(route.inferenceMode);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
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

export class EngineUnavailableError extends Error {
  name = 'EngineUnavailableError';
}
