import type { FollowUp, Likelihood, Severity, Solution } from '../lib/types';

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const strArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T =>
  opts.includes(v as T) ? (v as T) : fallback;

/** Extracts and normalises a Solution from raw model text. Throws if nothing usable is found. */
function extractJson(raw: string): Record<string, unknown> {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The model did not return structured guidance.');
  text = text.slice(start, end + 1);
  return JSON.parse(text) as Record<string, unknown>;
}

const parseSteps = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .map((s: Record<string, unknown> | string) =>
      typeof s === 'string' ? { title: s, detail: '' } : { title: str(s?.title), detail: str(s?.detail) },
    )
    .filter((s) => s.title);

export function parseFollowUp(raw: string): FollowUp {
  const j = extractJson(raw);
  const message = str(j.message);
  if (!message) throw new Error('The model did not return structured guidance.');
  return { message, steps: parseSteps(j.steps), safety: strArr(j.safety), seekProfessional: Boolean(j.seekProfessional) };
}

export function parseSolution(raw: string): Solution {
  const j = extractJson(raw);
  const causes = (Array.isArray(j.causes) ? j.causes : [])
    .map((c: Record<string, unknown>) => ({
      title: str(c?.title),
      // Smaller models sometimes repeat the likelihood in the text; the UI already shows it.
      detail: str(c?.detail).replace(/\s*\(?likelihood:?\s*(high|medium|low)\)?\.?\s*$/i, ''),
      likelihood: oneOf<Likelihood>(c?.likelihood, ['high', 'medium', 'low'], 'medium'),
    }))
    .filter((c) => c.title);
  const steps = parseSteps(j.steps);

  if (!steps.length && !causes.length) throw new Error('The model response was missing causes and steps.');

  return {
    title: str(j.title, 'Troubleshooting guide'),
    summary: str(j.summary),
    severity: oneOf<Severity>(j.severity, ['low', 'medium', 'high'], 'medium'),
    causes,
    steps,
    safety: strArr(j.safety),
    ifNotResolved: strArr(j.ifNotResolved),
    seekProfessional: Boolean(j.seekProfessional),
  };
}
