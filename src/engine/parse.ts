import type { FollowUp, Likelihood, Question, Severity, Solution } from '../lib/types';

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const strArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback: T): T =>
  opts.includes(v as T) ? (v as T) : fallback;

function extractJson(raw: string): Record<string, unknown> {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The model did not return structured guidance.');
  text = text.slice(start, end + 1);
  return JSON.parse(text) as Record<string, unknown>;
}

/** Closes any open strings, arrays and objects so a half-streamed JSON document can be parsed. */
function closeJson(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = s;
  if (inStr) out = (esc ? out.slice(0, -1) : out) + '"';
  out = out.replace(/[\s,:]+$/, '');
  return out + stack.reverse().join('');
}

/** Best-effort parse of a JSON document that is still streaming in. Returns null if nothing usable yet. */
export function parsePartialJson(raw: string): Record<string, unknown> | null {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '');
  const start = s.indexOf('{');
  if (start === -1) return null;
  s = s.slice(start);
  let cut = s.length;
  for (let tries = 0; tries < 40 && cut > 0; tries++) {
    try {
      return JSON.parse(closeJson(s.slice(0, cut))) as Record<string, unknown>;
    } catch {
      // Back off to the previous structural boundary and try again.
      const prev = Math.max(s.lastIndexOf(',', cut - 1), s.lastIndexOf('{', cut - 1), s.lastIndexOf('[', cut - 1));
      if (prev <= 0) return null;
      cut = s[prev] === ',' ? prev : prev + 1;
    }
  }
  return null;
}

const parseSteps = (v: unknown) =>
  (Array.isArray(v) ? v : [])
    .map((s: Record<string, unknown> | string) =>
      typeof s === 'string' ? { title: s, detail: '' } : { title: str(s?.title), detail: str(s?.detail) },
    )
    .filter((s) => s.title);

function parseQuestion(v: unknown): Question | undefined {
  const q = v as Record<string, unknown> | undefined;
  const text = str(q?.text);
  const options = strArr(q?.options).slice(0, 4);
  return text && options.length >= 2 ? { text, options } : undefined;
}

const parseSuggestions = (v: unknown) =>
  strArr(v)
    .filter((x) => x.length <= 80)
    .slice(0, 3);

export function parseFollowUp(raw: string): FollowUp {
  const j = extractJson(raw);
  const message = str(j.answer) || str(j.message);
  if (!message) throw new Error('The model did not return structured guidance.');
  const v = j.verdict as Record<string, unknown> | undefined;
  const level = oneOf(v?.level, ['none', 'safe', 'caution', 'unsafe'] as const, 'none');
  return {
    message,
    steps: parseSteps(j.steps),
    safety: strArr(j.safety),
    seekProfessional: Boolean(j.seekProfessional),
    verdict: level !== 'none' && str(v?.reason) ? { level, reason: str(v?.reason) } : undefined,
    tools: strArr(j.tools),
    question: parseQuestion(j.question),
    suggestions: parseSuggestions(j.suggestions),
  };
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

  const answer = str(j.answer) || str(j.summary);
  return {
    title: str(j.title, 'Troubleshooting guide'),
    summary: str(j.summary) || answer,
    answer,
    severity: oneOf<Severity>(j.severity, ['low', 'medium', 'high'], 'medium'),
    causes,
    steps,
    safety: strArr(j.safety),
    ifNotResolved: strArr(j.ifNotResolved),
    seekProfessional: Boolean(j.seekProfessional),
    question: parseQuestion(j.question),
    suggestions: parseSuggestions(j.suggestions),
  };
}
