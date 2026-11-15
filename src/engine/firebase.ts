/**
 * Firebase AI Logic — hybrid inference (on-device Gemini Nano + cloud Gemini Flash).
 * Every AI request in PocketOps goes through this module.
 */
import type { GenerativeModel, InferenceMode } from 'firebase/ai';
import { getFirebaseApp } from '../lib/firebaseApp';
import { getRuntimeConfig } from '../lib/remoteConfig';
import { SOLUTION_JSON_SCHEMA } from './prompt';

export { firebaseConfigured } from '../lib/firebaseApp';

const CLOUD_TIMEOUT_MS = 60_000;

const models = new Map<string, Promise<GenerativeModel>>();

function getModel(mode: InferenceMode, cloudModel: string): Promise<GenerativeModel> {
  const key = `${mode}:${cloudModel}`;
  let p = models.get(key);
  if (!p) {
    p = (async () => {
      const [app, ai] = await Promise.all([getFirebaseApp(), import('firebase/ai')]);
      const instance = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
      return ai.getGenerativeModel(
        instance,
        {
          mode,
          // On-device (Gemini Nano via Chrome's Prompt API) is constrained to the same JSON schema.
          onDeviceParams: { promptOptions: { responseConstraint: SOLUTION_JSON_SCHEMA } },
          inCloudParams: {
            model: cloudModel,
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
          },
        },
        { timeout: CLOUD_TIMEOUT_MS },
      );
    })();
    models.set(key, p);
    p.catch(() => models.delete(key));
  }
  return p;
}

export async function generateWithFirebase(
  prompt: string,
  mode: InferenceMode,
  signal?: AbortSignal,
): Promise<{ text: string; source: 'on-device' | 'cloud' }> {
  const model = await getModel(mode, getRuntimeConfig().cloudModel);
  try {
    const result = await model.generateContent(prompt, { signal });
    return {
      text: result.response.text(),
      // The SDK reports which side actually answered.
      source: result.response.inferenceSource === 'on_device' ? 'on-device' : 'cloud',
    };
  } catch (e) {
    throw friendlyError(e);
  }
}

function friendlyError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort/i.test(msg)) return e as Error;
  if (/app check/i.test(msg))
    return new Error(
      'Firebase App Check rejected this request. Add your reCAPTCHA Enterprise site key (and a debug token for localhost) to .env — see README.',
    );
  if (/\b404\b|not found|no longer available/i.test(msg))
    return new Error(`The cloud model "${getRuntimeConfig().cloudModel}" isn't available. Update cloud_model in Remote Config or VITE_GEMINI_MODEL.`);
  if (/\b429\b|quota|resource.exhausted/i.test(msg)) return new Error('Cloud AI quota reached. Try again shortly, or use on-device mode.');
  if (/timeout|timed out|deadline/i.test(msg)) return new Error('The cloud model took too long to respond. Please try again.');
  if (/failed to fetch|network/i.test(msg)) return new Error('Couldn’t reach Firebase AI Logic. Check your connection and try again.');
  return e instanceof Error ? e : new Error(msg);
}
