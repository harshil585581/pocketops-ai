/**
 * Cloud sync: Firebase Authentication + Cloud Firestore.
 *
 * - Every visitor is signed in anonymously, so saved guides are backed up to
 *   users/{uid}/sessions with no login screen.
 * - "Sign in with Google" links that anonymous account (or switches to an existing one),
 *   which makes the same guides available on every device.
 * - IndexedDB stays the source of truth on-device; changes are pushed when online and
 *   remote changes are merged in by updatedAt (last write wins).
 */
import { useSyncExternalStore } from 'react';
import type { Auth, User } from 'firebase/auth';
import type { CollectionReference, Firestore } from 'firebase/firestore';
import { firebaseConfigured, getFirebaseApp } from './firebaseApp';
import {
  clearPendingDeletes,
  deleteSession,
  getPendingDeletes,
  getSession,
  listSessions,
  onSessionsChange,
  putSessionRaw,
} from './db';
import type { Session } from './types';

export type SyncStatus = 'disabled' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  uid?: string;
  isAnonymous?: boolean;
  email?: string | null;
  lastSyncedAt?: number;
  error?: string;
}

let state: SyncState = { status: firebaseConfigured ? 'connecting' : 'disabled' };
const listeners = new Set<() => void>();
const set = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const useSync = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );

let auth: Auth | null = null;
let fs: Firestore | null = null;
let col: CollectionReference | null = null;
let unsubSnapshot: (() => void) | null = null;
let started = false;

const LAST_UID = 'pocketops:sync-uid';

export async function startSync() {
  if (!firebaseConfigured || started) return;
  started = true;
  try {
    const app = await getFirebaseApp();
    const [{ getAuth, onAuthStateChanged }, { initializeFirestore }] = await Promise.all([
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    auth = getAuth(app);
    fs = initializeFirestore(app, { ignoreUndefinedProperties: true });

    onAuthStateChanged(auth, (user) => (user ? attach(user) : ensureSignedIn()));
    window.addEventListener('online', () => {
      set({ status: 'connecting' });
      if (!auth?.currentUser) ensureSignedIn();
      else pushChanges();
    });
    window.addEventListener('offline', () => set({ status: 'offline' }));
    onSessionsChange(schedulePush);
    if (!navigator.onLine) set({ status: 'offline' });
  } catch (e) {
    set({ status: 'error', error: describe(e) });
  }
}

async function ensureSignedIn() {
  if (!auth || !navigator.onLine) return set({ status: navigator.onLine ? 'connecting' : 'offline' });
  try {
    const { signInAnonymously } = await import('firebase/auth');
    await signInAnonymously(auth);
  } catch (e) {
    set({ status: 'error', error: describe(e) });
  }
}

async function attach(user: User) {
  set({ uid: user.uid, isAnonymous: user.isAnonymous, email: user.email, status: navigator.onLine ? 'syncing' : 'offline', error: undefined });

  // Account changed (e.g. signed in with Google): re-upload everything on this device to the new account.
  try {
    if (localStorage.getItem(LAST_UID) !== user.uid) {
      localStorage.setItem(LAST_UID, user.uid);
      for (const s of await listSessions()) if (!s.sample && s.syncedAt) await putSessionRaw({ ...s, syncedAt: 0 });
    }
  } catch {
    /* storage unavailable */
  }

  const { collection, onSnapshot } = await import('firebase/firestore');
  unsubSnapshot?.();
  col = collection(fs!, 'users', user.uid, 'sessions');
  unsubSnapshot = onSnapshot(
    col,
    async (snap) => {
      for (const change of snap.docChanges()) {
        if (change.doc.metadata.hasPendingWrites) continue;
        const id = change.doc.id;
        if (change.type === 'removed') {
          await deleteSession(id, { fromSync: true });
          continue;
        }
        const remote = change.doc.data() as Session;
        const local = await getSession(id);
        if (getPendingDeletes().includes(id)) continue;
        if (!local || remote.updatedAt > local.updatedAt) await putSessionRaw({ ...withLocalPhotos(remote, local), syncedAt: remote.updatedAt });
        else if (local.updatedAt === remote.updatedAt && local.syncedAt !== remote.updatedAt)
          await putSessionRaw({ ...local, syncedAt: remote.updatedAt });
      }
      if (!snap.metadata.fromCache) await pushChanges();
    },
    (e) => set({ status: 'error', error: describe(e) }),
  );
}

/**
 * Photos stay on the device that took them: they would quickly push a session past
 * Firestore's 1 MB document limit.
 */
function withoutPhotos(s: Session): Session {
  const { images: _images, ...rest } = s;
  return { ...rest, turns: rest.turns?.map((t) => (t.role === 'user' && t.images ? { ...t, images: undefined } : t)) };
}

/** Keeps this device's photos when a newer copy of the session arrives from Firestore. */
function withLocalPhotos(remote: Session, local?: Session): Session {
  if (!local) return remote;
  const photos = new Map((local.turns ?? []).flatMap((t) => (t.role === 'user' && t.images ? [[t.id, t.images] as const] : [])));
  return {
    ...remote,
    images: local.images,
    turns: remote.turns?.map((t) => (t.role === 'user' && photos.has(t.id) ? { ...t, images: photos.get(t.id) } : t)),
  };
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushChanges, 600);
}

let pushing = false;
async function pushChanges() {
  if (!col || !navigator.onLine || pushing) return;
  pushing = true;
  try {
    const { doc, setDoc, deleteDoc } = await import('firebase/firestore');
    const dirty = (await listSessions()).filter((s) => !s.sample && (s.syncedAt ?? 0) < s.updatedAt);
    const deletes = getPendingDeletes();
    if (dirty.length || deletes.length) set({ status: 'syncing' });

    for (const s of dirty) {
      const { syncedAt: _ignored, ...data } = withoutPhotos(s);
      await setDoc(doc(col, s.id), data);
      const latest = await getSession(s.id);
      // Only mark as synced if it wasn't edited again while uploading.
      if (latest && latest.updatedAt === s.updatedAt) await putSessionRaw({ ...latest, syncedAt: s.updatedAt });
    }
    for (const id of deletes) await deleteDoc(doc(col, id));
    clearPendingDeletes(deletes);
    set({ status: 'synced', lastSyncedAt: Date.now(), error: undefined });
  } catch (e) {
    set({ status: 'error', error: describe(e) });
  } finally {
    pushing = false;
  }
}

/** Links the anonymous account to Google, or switches to the existing Google account. */
export async function signInWithGoogle() {
  if (!auth) throw new Error('Sync isn’t available.');
  const { GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithCredential } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;
  try {
    if (current?.isAnonymous) {
      const res = await linkWithPopup(current, provider);
      await attach(res.user); // same uid, now permanent
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/credential-already-in-use') {
      // This Google account already has data from another device — switch to it; local guides are re-uploaded.
      const cred = GoogleAuthProvider.credentialFromError(e as never);
      if (cred) return void (await signInWithCredential(auth, cred));
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    throw new Error(describe(e));
  }
}

export async function signOutOfSync() {
  if (!auth) return;
  const { signOut } = await import('firebase/auth');
  await signOut(auth); // onAuthStateChanged signs back in anonymously
}

function describe(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const msg = e instanceof Error ? e.message : String(e);
  if (code === 'auth/configuration-not-found' || /CONFIGURATION_NOT_FOUND/.test(msg))
    return 'Turn on Firebase Authentication (console → Authentication → Get started), then enable Anonymous and Google sign-in.';
  if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed')
    return 'Enable Anonymous and Google sign-in in Firebase console → Authentication → Sign-in method.';
  if (code === 'permission-denied') return 'Firestore rejected the request. Deploy firestore.rules (see README).';
  if (code === 'not-found' || /database .* does not exist|NOT_FOUND/i.test(msg))
    return 'Create a Cloud Firestore database in the Firebase console.';
  if (/app.?check/i.test(msg)) return 'Firebase App Check rejected the request — check your reCAPTCHA site key / debug token.';
  if (code === 'auth/unauthorized-domain') return 'Add this domain in Firebase console → Authentication → Settings → Authorized domains.';
  return msg;
}
