import type { CategoryId, Session } from '../lib/types';

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
      minItems: 3,
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
      minItems: 4,
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

const FOLLOWUP_INSTRUCTION = `You are PocketOps, a calm, practical troubleshooting assistant. The user already received a troubleshooting guide and is following up in the same conversation.

Respond ONLY with a JSON object matching the provided schema:
- message: 2–4 sentences that directly answer the user's latest message, referring to what they tried.
- steps: 0–6 NEW concrete steps to try next (empty if the message is just an explanation). Don't repeat steps the user already completed.
- safety: precautions relevant to these next steps (empty array if none).
- seekProfessional: true when they should now involve a qualified technician.

Prefer safe, reversible checks. Never instruct anyone to bypass safety devices. Be concise and specific.`;

/** Builds a compact follow-up prompt (kept short so it also fits Gemini Nano's context). */
export function buildFollowUpPrompt(session: Session, message: string, instructionOverride = ''): string {
  const sol = session.solution;
  const done = new Set(session.completedSteps);
  const lines = [
    instructionOverride ? `${instructionOverride}\n\n${FOLLOWUP_INSTRUCTION}` : FOLLOWUP_INSTRUCTION,
    '',
    `Original problem: """${session.problem.trim()}"""`,
    `Guide given: ${sol.title}. Likely causes: ${sol.causes.map((c) => c.title).join('; ')}.`,
    `Steps: ${sol.steps.map((st, i) => `${i + 1}. ${st.title}${done.has(i) ? ' (done)' : ''}`).join(' ')}`,
  ];
  const history = (session.turns ?? []).slice(-6);
  if (history.length) {
    lines.push('', 'Conversation so far:');
    for (const t of history) {
      if (t.role === 'user') lines.push(`User: ${t.action === 'deep' ? '(asked for a deep analysis)' : t.text}`);
      else if (t.kind === 'reply')
        lines.push(`PocketOps: ${t.reply.message}${t.reply.steps.length ? ` Suggested: ${t.reply.steps.map((x) => x.title).join('; ')}.` : ''}`);
      else lines.push(`PocketOps: (deep analysis) ${t.solution.summary}`);
    }
  }
  lines.push('', `User's new message: """${message.trim()}"""`);
  return lines.join('\n');
}

export const FOLLOWUP_JSON_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, detail: { type: 'string' } },
        required: ['title', 'detail'],
      },
    },
    safety: { type: 'array', items: { type: 'string' } },
    seekProfessional: { type: 'boolean' },
  },
  required: ['message', 'steps', 'safety', 'seekProfessional'],
} as const;
