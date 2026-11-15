/**
 * Firebase Remote Config — lets the AI setup be changed without redeploying:
 *   cloud_model          Gemini model used for cloud inference
 *   long_problem_chars   descriptions at least this long are routed to the cloud first
 *   system_instruction   optional override for the troubleshooting instructions
 * Last-activated values are cached by the SDK, so they still apply offline.
 */
import { useSyncExternalStore } from 'react';
import { firebaseConfigured, getFirebaseApp } from './firebaseApp';

export interface RuntimeConfig {
  cloudModel: string;
  longProblemChars: number;
  systemInstruction: string;
  /** Where the values came from: built-in defaults or a fetched Remote Config template. */
  origin: 'default' | 'remote';
}

const DEFAULT_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.8-flash';
const DEFAULTS = { cloud_model: DEFAULT_MODEL, long_problem_chars: 600, system_instruction: '' };

let current: RuntimeConfig = {
  cloudModel: DEFAULTS.cloud_model,
  longProblemChars: DEFAULTS.long_problem_chars,
  systemInstruction: '',
  origin: 'default',
};
const listeners = new Set<() => void>();

export const getRuntimeConfig = () => current;

export const useRuntimeConfig = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getRuntimeConfig,
  );

let started = false;

export async function initRemoteConfig() {
  if (!firebaseConfigured || started) return;
  started = true;
  try {
    const app = await getFirebaseApp();
    const rc = await import('firebase/remote-config');
    const remote = rc.getRemoteConfig(app);
    remote.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 60 * 60_000;
    remote.defaultConfig = DEFAULTS;

    const apply = () => {
      const model = rc.getValue(remote, 'cloud_model');
      const chars = rc.getNumber(remote, 'long_problem_chars');
      current = {
        cloudModel: model.asString() || DEFAULTS.cloud_model,
        longProblemChars: chars > 0 ? chars : DEFAULTS.long_problem_chars,
        systemInstruction: rc.getString(remote, 'system_instruction').trim(),
        origin: model.getSource() === 'remote' ? 'remote' : 'default',
      };
      listeners.forEach((l) => l());
    };

    await rc.ensureInitialized(remote); // loads the last activated (cached) template
    apply();
    if (navigator.onLine) {
      await rc.fetchAndActivate(remote);
      apply();
    }
  } catch (e) {
    console.warn('Remote Config unavailable, using defaults.', e);
  }
}
