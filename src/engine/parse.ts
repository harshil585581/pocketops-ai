import type { Likelihood, Severity, Solution } from '../lib/types';

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const strArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T =>
  opts.includes(v as T) ? (v as T) : fallback;

/** Extracts and normalises a Solution from raw model text. Throws if nothing usable is found. */
export function parseSolution(raw: string): Solution {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The model did not return structured guidance.');
  text = text.slice(start, end + 1);

  const j = JSON.parse(text) as Record<string, unknown>;
  const causes = (Array.isArray(j.causes) ? j.causes : [])
    .map((c: Record<string, unknown>) => ({
      title: str(c?.title),
      detail: str(c?.detail),
      likelihood: oneOf<Likelihood>(c?.likelihood, ['high', 'medium', 'low'], 'medium'),
    }))
    .filter((c) => c.title);
  const steps = (Array.isArray(j.steps) ? j.steps : [])
    .map((s: Record<string, unknown> | string) =>
      typeof s === 'string' ? { title: s, detail: '' } : { title: str(s?.title), detail: str(s?.detail) },
    )
    .filter((s) => s.title);

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
