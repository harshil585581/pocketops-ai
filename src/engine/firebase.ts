/**
 * Firebase AI Logic — hybrid inference (on-device Gemini Nano + cloud Gemini Flash).
 * Every AI request in PocketOps goes through this module.
 */
import type { GenerativeModel, InferenceMode, ThinkingLevel } from 'firebase/ai';
import { getFirebaseApp } from '../lib/firebaseApp';
import { SOLUTION_JSON_SCHEMA } from './prompt';

export { firebaseConfigured } from '../lib/firebaseApp';

export interface CloudOptions {
  /** Gemini model for the cloud side of the request. */
  model: string;
  timeoutMs: number;
}

const models = new Map<string, Promise<GenerativeModel>>();

function getModel(mode: InferenceMode, { model: cloudModel, timeoutMs }: CloudOptions): Promise<GenerativeModel> {
  const key = `${mode}:${cloudModel}:${timeoutMs}`;
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
            generationConfig: {
              responseMimeType: 'application/json',
              // Same JSON Schema as on-device, so both models return an identical shape.
              responseJsonSchema: SOLUTION_JSON_SCHEMA as unknown as Record<string, unknown>,
              temperature: 0.4,
              // Low thinking keeps structured troubleshooting answers fast.
              thinkingConfig: { thinkingLevel: 'LOW' as ThinkingLevel },
            },
          },
        },
        { timeout: timeoutMs },
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
  cloud: CloudOptions,
  signal?: AbortSignal,
): Promise<{ text: string; source: 'on-device' | 'cloud' }> {
  const model = await getModel(mode, cloud);
  try {
    const result = await model.generateContent(prompt, { signal });
    return {
      text: result.response.text(),
      // The SDK reports which side actually answered.
      source: result.response.inferenceSource === 'on_device' ? 'on-device' : 'cloud',
    };
  } catch (e) {
    throw friendlyError(e, cloud.model);
  }
}

export class CloudBusyError extends Error {
  name = 'CloudBusyError';
}

function friendlyError(e: unknown, cloudModel: string): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort/i.test(msg)) return e as Error;
  if (/app check/i.test(msg))
    return new Error(
      'Firebase App Check rejected this request. Add your reCAPTCHA Enterprise site key (and a debug token for localhost) to .env — see README.',
    );
  if (/\b404\b|not found|no longer available/i.test(msg))
    return new Error(`The cloud model "${cloudModel}" isn't available. Update it in Remote Config or .env.`);
  if (/\b429\b|quota|resource.exhausted/i.test(msg)) return new Error('Cloud AI quota reached. Try again shortly, or use on-device mode.');
  if (/high demand|overloaded|\b50[0-4]\b|unavailable/i.test(msg))
    return new CloudBusyError('Gemini is busy right now (high demand). Please try again in a moment.');
  if (/timeout|timed out|deadline|expired/i.test(msg)) return new CloudBusyError('The cloud model took too long to respond. Please try again.');
  if (/failed to fetch|network/i.test(msg)) return new Error('Couldn’t reach Firebase AI Logic. Check your connection and try again.');
  return e instanceof Error ? e : new Error(msg);
}
