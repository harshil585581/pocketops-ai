import type { CategoryId } from '../lib/types';

export const SYSTEM_INSTRUCTION = `You are PocketOps, a calm, practical troubleshooting assistant for people fixing real-world problems with devices, machines, vehicles, home systems and equipment — often in the field with poor connectivity.

Given a problem description, respond ONLY with a JSON object matching the provided schema:
- title: a short name for the issue (max 8 words).
- summary: 1–2 sentences explaining what is most likely going on.
- severity: "low", "medium" or "high" based on risk to people or equipment.
- causes: 3–5 possible causes, most likely first, each with a likelihood of "high", "medium" or "low".
- steps: 4–7 concrete troubleshooting steps in the order a person should do them. Each step has a short imperative title and a one or two sentence detail.
- safety: precautions relevant to this problem (empty array if genuinely none).
- ifNotResolved: 2–4 next actions if the steps do not fix it.
- seekProfessional: true when the user should involve a qualified technician.

Prefer safe, reversible checks before invasive ones. Never instruct anyone to bypass safety devices. Be concise and specific.`;

const DEEP_INSTRUCTION = `This is a DEEP ANALYSIS request. Go beyond quick triage:
- causes: 4–6 causes; in each detail, say how to confirm or rule it out (a specific test, reading or observation).
- steps: 6–10 steps, ordered from safest and cheapest to most involved. In each detail, include what result to expect and what it tells you. Mention tools needed where relevant.
- ifNotResolved: 3–4 next actions, including what information to give a technician.`;

export type Depth = 'quick' | 'deep';

export function buildPrompt(problem: string, category: CategoryId, depth: Depth, instructionOverride = ''): string {
  const hint = category === 'other' ? '' : `\nCategory: ${category}`;
  const base = instructionOverride || SYSTEM_INSTRUCTION;
  const deep = depth === 'deep' ? `\n\n${DEEP_INSTRUCTION}` : '';
  return `${base}${deep}\n\nProblem:${hint}\n"""${problem.trim()}"""`;
}

/** Plain JSON Schema — used as the Prompt API responseConstraint for on-device output. */
export const SOLUTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    causes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          likelihood: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'likelihood'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, detail: { type: 'string' } },
        required: ['title', 'detail'],
      },
    },
    safety: { type: 'array', items: { type: 'string' } },
    ifNotResolved: { type: 'array', items: { type: 'string' } },
    seekProfessional: { type: 'boolean' },
  },
  required: ['title', 'summary', 'severity', 'causes', 'steps', 'safety', 'ifNotResolved', 'seekProfessional'],
} as const;
