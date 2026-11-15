import type { CategoryId, Session } from '../lib/types';

const STYLE = `Write like an experienced, friendly technician talking to someone standing next to the problem: warm, direct, plain words. Use **bold** for the key thing to check. Prefer safe, reversible checks before invasive ones. Never instruct anyone to bypass safety devices.`;

export const SYSTEM_INSTRUCTION = `You are PocketOps, a calm, practical troubleshooting assistant for people fixing real-world problems with devices, machines, vehicles, home systems and equipment — often in the field with poor connectivity.

${STYLE}

Respond ONLY with a JSON object matching the provided schema, in this field order:
- title: a short name for the issue (max 8 words).
- answer: 2–3 conversational sentences: what is most likely going on and what to do first.
- severity: "low", "medium" or "high" based on risk to people or equipment.
- causes: 3–5 possible causes, most likely first, each with a likelihood of "high", "medium" or "low".
- safety: precautions relevant to this problem (empty array if genuinely none).
- steps: 4–7 concrete troubleshooting steps in the order a person should do them. Each step has a short imperative title and a one or two sentence detail.
- question: if ONE quick answer from the user would clearly change the next steps, ask it in "text" with 2–4 short tappable "options"; otherwise text "" and options [].
- ifNotResolved: 2–4 next actions if the steps do not fix it.
- seekProfessional: true when the user should involve a qualified technician.
- suggestions: 3 short follow-up questions the user is likely to ask next (max 7 words each).`;

const DEEP_INSTRUCTION = `This is a DEEP ANALYSIS request. Go beyond quick triage:
- causes: 4–6 causes; in each detail, say how to confirm or rule it out (a specific test, reading or observation).
- steps: 6–10 steps, ordered from safest and cheapest to most involved. In each detail, include what result to expect and what it tells you. Mention tools needed where relevant.
- ifNotResolved: 3–4 next actions, including what information to give a technician.`;

export type Depth = 'quick' | 'deep';

export function buildPrompt(problem: string, category: CategoryId, depth: Depth, instructionOverride = ''): string {
  const hint = category === 'other' ? '' : `\nCategory: ${category}`;
  const base = instructionOverride ? `${instructionOverride}\n\n${SYSTEM_INSTRUCTION}` : SYSTEM_INSTRUCTION;
  const deep = depth === 'deep' ? `\n\n${DEEP_INSTRUCTION}` : '';
  return `${base}${deep}\n\nProblem:${hint}\n"""${problem.trim()}"""`;
}

const STEP = {
  type: 'object',
  properties: { title: { type: 'string' }, detail: { type: 'string' } },
  required: ['title', 'detail'],
} as const;

const QUESTION = {
  type: 'object',
  properties: { text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
  required: ['text', 'options'],
} as const;

/** Shared JSON Schema (property order = streaming order) for on-device and cloud output. */
export const SOLUTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    answer: { type: 'string' },
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
    safety: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', minItems: 4, items: STEP },
    question: QUESTION,
    ifNotResolved: { type: 'array', items: { type: 'string' } },
    seekProfessional: { type: 'boolean' },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'answer', 'severity', 'causes', 'safety', 'steps', 'question', 'ifNotResolved', 'seekProfessional', 'suggestions'],
} as const;

const FOLLOWUP_INSTRUCTION = `You are PocketOps, a calm, practical troubleshooting assistant. The user already received a troubleshooting guide and is following up in the same conversation.

${STYLE}

Shape the reply to what they asked. Respond ONLY with a JSON object matching the provided schema, in this field order:
- answer: 1–4 conversational sentences that directly answer the latest message, referring to what they tried. Can use short "- " bullet lists.
- verdict: if they asked whether something is safe, level "safe", "caution" or "unsafe" with a one-sentence reason; otherwise level "none" and reason "".
- tools: tools or parts needed, only if they asked or the new steps need them (else []).
- safety: precautions for these next steps (else []).
- steps: 0–6 NEW concrete steps to try next (empty if the answer is just an explanation). Don't repeat steps already completed.
- question: if ONE quick answer would clearly change the next steps, ask it with 2–4 short options; otherwise text "" and options [].
- seekProfessional: true when they should now involve a qualified technician.
- suggestions: 3 short follow-up questions they might ask next (max 7 words each).`;

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
  if (sol.question) lines.push(`PocketOps asked: ${sol.question.text}`);
  const history = (session.turns ?? []).slice(-6);
  if (history.length) {
    lines.push('', 'Conversation so far:');
    for (const t of history) {
      if (t.role === 'user') lines.push(`User: ${t.action === 'deep' ? '(asked for a deep analysis)' : t.text}`);
      else if (t.kind === 'reply')
        lines.push(
          `PocketOps: ${t.reply.message}${t.reply.steps.length ? ` Suggested: ${t.reply.steps.map((x) => x.title).join('; ')}.` : ''}${t.reply.question ? ` Asked: ${t.reply.question.text}` : ''}`,
        );
      else lines.push(`PocketOps: (deep analysis) ${t.solution.summary}`);
    }
  }
  lines.push('', `User's new message: """${message.trim()}"""`);
  return lines.join('\n');
}

export const FOLLOWUP_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    verdict: {
      type: 'object',
      properties: { level: { type: 'string', enum: ['none', 'safe', 'caution', 'unsafe'] }, reason: { type: 'string' } },
      required: ['level', 'reason'],
    },
    tools: { type: 'array', items: { type: 'string' } },
    safety: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: STEP },
    question: QUESTION,
    seekProfessional: { type: 'boolean' },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'verdict', 'tools', 'safety', 'steps', 'question', 'seekProfessional', 'suggestions'],
} as const;
