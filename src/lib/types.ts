export type Likelihood = 'high' | 'medium' | 'low';
export type Severity = 'low' | 'medium' | 'high';

export interface Cause {
  title: string;
  detail: string;
  likelihood: Likelihood;
}

export interface Step {
  title: string;
  detail: string;
}

/** Structured guidance produced by any engine (on-device, cloud or demo). */
export interface Solution {
  title: string;
  summary: string;
  severity: Severity;
  causes: Cause[];
  steps: Step[];
  safety: string[];
  ifNotResolved: string[];
  seekProfessional: boolean;
}

/** Where a response was actually generated ('demo' = built-in example guide, not AI output). */
export type InferenceSource = 'on-device' | 'cloud' | 'demo';

/** User routing preference. */
export type EngineMode = 'auto' | 'local-only' | 'cloud-only';

export type CategoryId =
  | 'electronics'
  | 'appliance'
  | 'vehicle'
  | 'network'
  | 'electrical'
  | 'plumbing'
  | 'other';

export interface Session {
  id: string;
  createdAt: number;
  /** Last local modification — drives Firestore sync conflict resolution (last write wins). */
  updatedAt: number;
  /** updatedAt value last confirmed in Firestore; behind updatedAt means a pending upload. */
  syncedAt?: number;
  problem: string;
  category: CategoryId;
  solution: Solution;
  source: InferenceSource;
  model: string;
  durationMs: number;
  completedSteps: number[];
  /** Quick triage or cloud deep analysis. */
  depth?: 'quick' | 'deep';
  /** Firebase AI Logic hybrid mode the request used, e.g. "prefer_on_device". */
  inferenceMode?: string;
  /** For a deep analysis: the guide it expands on. */
  parentId?: string;
  /** Built-in example data, shown with an "Example" tag and never synced. */
  sample?: boolean;
  /** Conversation after the first guide: follow-up questions, replies and deep analyses. */
  turns?: Turn[];
  /** Troubleshooting outcome set by the user. */
  status?: 'open' | 'resolved';
}

/** A conversational follow-up answer (lighter than a full guide). */
export interface FollowUp {
  message: string;
  steps: Step[];
  safety: string[];
  seekProfessional: boolean;
}

interface AssistantMeta {
  id: string;
  role: 'assistant';
  createdAt: number;
  source: InferenceSource;
  model: string;
  durationMs: number;
  inferenceMode?: string;
  completedSteps: number[];
}

export type Turn =
  | { id: string; role: 'user'; createdAt: number; text: string; action?: 'deep' }
  | (AssistantMeta & { kind: 'reply'; reply: FollowUp })
  | (AssistantMeta & { kind: 'guide'; solution: Solution; depth: 'quick' | 'deep' });

export type AssistantTurn = Extract<Turn, { role: 'assistant' }>;
