/**
 * IndexedDB is the source of truth on the device, so everything works offline.
 * Firestore sync (lib/sync.ts) mirrors these records to the signed-in user's account.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { Session } from './types';
import { buildSampleSessions } from './samples';
import { tokenize } from './format';

const DB_NAME = 'pocketops';
const STORE = 'sessions';
const CHANGE_EVENT = 'pocketops:db-change';
const SEED_FLAG = 'pocketops:seeded:v2';
const PENDING_DELETES = 'pocketops:pending-deletes';

let dbp: Promise<IDBPDatabase> | null = null;
const db = () =>
  (dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      const s = d.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('createdAt', 'createdAt');
    },
  }));

const emit = () => window.dispatchEvent(new Event(CHANGE_EVENT));

export const onSessionsChange = (fn: () => void) => {
  window.addEventListener(CHANGE_EVENT, fn);
  return () => window.removeEventListener(CHANGE_EVENT, fn);
};

/** Older records may predate updatedAt. */
const normalize = (s: Session): Session => (s.updatedAt ? s : { ...s, updatedAt: s.createdAt });

export async function listSessions(): Promise<Session[]> {
  const all = ((await (await db()).getAll(STORE)) as Session[]).map(normalize);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSession(id: string) {
  const s = (await (await db()).get(STORE, id)) as Session | undefined;
  return s && normalize(s);
}

/** User-initiated change: bumps updatedAt so the record is queued for sync. */
export async function putSession(s: Session) {
  await (await db()).put(STORE, { ...s, updatedAt: Date.now() });
  emit();
}

/**
 * Atomic read-modify-write in one IndexedDB transaction, so rapid edits (e.g. ticking
 * several steps quickly) can't overwrite each other. `fn` must be synchronous.
 */
export async function updateSession(id: string, fn: (s: Session) => Session): Promise<Session | undefined> {
  const tx = (await db()).transaction(STORE, 'readwrite');
  const current = (await tx.store.get(id)) as Session | undefined;
  if (!current) {
    await tx.done;
    return undefined;
  }
  const next = { ...fn(normalize(current)), updatedAt: Date.now() };
  await tx.store.put(next);
  await tx.done;
  emit();
  return next;
}

/** Sync-initiated write: stores the record exactly as given. */
export async function putSessionRaw(s: Session) {
  await (await db()).put(STORE, s);
  emit();
}

export async function deleteSession(id: string, { fromSync = false } = {}) {
  const existing = await getSession(id);
  await (await db()).delete(STORE, id);
  if (!fromSync && existing && !existing.sample) addPendingDeletes([id]);
  emit();
}

export async function clearSessions() {
  const all = await listSessions();
  await (await db()).clear(STORE);
  addPendingDeletes(all.filter((s) => !s.sample).map((s) => s.id));
  emit();
}

// ── Pending remote deletions (survive reloads and offline periods) ──
export function getPendingDeletes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_DELETES) || '[]');
  } catch {
    return [];
  }
}
function addPendingDeletes(ids: string[]) {
  if (!ids.length) return;
  try {
    localStorage.setItem(PENDING_DELETES, JSON.stringify([...new Set([...getPendingDeletes(), ...ids])]));
  } catch {
    /* ignore */
  }
}
export function clearPendingDeletes(ids: string[]) {
  try {
    localStorage.setItem(PENDING_DELETES, JSON.stringify(getPendingDeletes().filter((x) => !ids.includes(x))));
  } catch {
    /* ignore */
  }
}

/** Seeds a few example guides on first launch so the app is useful (and demo-able) immediately. */
export async function seedIfNeeded() {
  try {
    if (localStorage.getItem(SEED_FLAG)) return;
    localStorage.setItem(SEED_FLAG, '1');
  } catch {
    return;
  }
  const d = await db();
  const tx = d.transaction(STORE, 'readwrite');
  await Promise.all([...buildSampleSessions().map((s) => tx.store.put(s)), tx.done]);
  emit();
}

/** Finds saved guidance relevant to a new problem — used when no AI engine is reachable. */
export async function findRelated(problem: string, limit = 3): Promise<Session[]> {
  const q = new Set(tokenize(problem));
  if (!q.size) return [];
  return (await listSessions())
    .map((s) => {
      const hay = new Set(tokenize(`${s.problem} ${s.solution.title} ${s.solution.summary}`));
      let score = 0;
      hay.forEach((w) => q.has(w) && score++);
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}
