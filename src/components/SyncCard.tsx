import { useState } from 'react';
import { CloudOff, Loader2, LogIn, LogOut, RefreshCw, UserRound } from 'lucide-react';
import { signInWithGoogle, signOutOfSync, useSync, type SyncStatus } from '../lib/sync';
import { relativeTime } from '../lib/format';
import { useToast } from '../state/toast';
import { StatusDot, cx } from './ui';

const LABEL: Record<SyncStatus, string> = {
  disabled: 'Not configured',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Up to date',
  offline: 'Offline — changes queued',
  error: 'Sync problem',
};

const TONE: Record<SyncStatus, 'local' | 'cloud' | 'warn' | 'danger' | 'muted'> = {
  disabled: 'muted',
  connecting: 'cloud',
  syncing: 'cloud',
  synced: 'local',
  offline: 'warn',
  error: 'danger',
};

/** Firebase Authentication + Firestore sync status and account controls. */
export function SyncCard() {
  const sync = useSync();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      push({ tone: 'error', title: 'Sign-in failed', body: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  if (sync.status === 'disabled') {
    return (
      <div className="card flex items-center gap-3 p-4 text-[13px] text-ink-2">
        <CloudOff className="size-4 text-ink-3" /> Add your Firebase config to back up and sync saved guides.
      </div>
    );
  }

  return (
    <div className="card divide-y divide-line">
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13.5px] font-medium">
            <StatusDot tone={TONE[sync.status]} pulse={sync.status === 'syncing' || sync.status === 'connecting'} />
            {LABEL[sync.status]}
          </p>
          <p className={cx('mt-0.5 text-[12.5px]', sync.status === 'error' ? 'text-danger' : 'text-ink-3')}>
            {sync.status === 'error'
              ? sync.error
              : sync.lastSyncedAt
                ? `Last synced ${relativeTime(sync.lastSyncedAt).toLowerCase()} · Cloud Firestore`
                : 'Saved guides are mirrored to Cloud Firestore.'}
          </p>
        </div>
        {(sync.status === 'syncing' || sync.status === 'connecting') && <Loader2 className="size-4 shrink-0 animate-spin text-ink-3" />}
        {sync.status === 'error' && <RefreshCw className="size-4 shrink-0 text-ink-3" />}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium">
              {sync.uid ? (sync.isAnonymous ? 'Anonymous account' : sync.email || 'Google account') : 'Not signed in'}
            </p>
            <p className="truncate text-[12.5px] text-ink-3">
              {!sync.uid
                ? 'Guides stay on this device until sign-in works.'
                : sync.isAnonymous
                  ? 'Backed up for this browser. Sign in to sync across devices.'
                  : 'Your guides sync on every device you sign in to.'}
            </p>
          </div>
        </div>
        {sync.uid &&
          (sync.isAnonymous ? (
            <button onClick={google} disabled={busy || sync.status === 'offline'} className="btn-primary h-8 shrink-0 text-[13px]">
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />} Sign in with Google
            </button>
          ) : (
            <button onClick={() => signOutOfSync()} className="btn-secondary h-8 shrink-0 text-[13px]">
              <LogOut className="size-3.5" /> Sign out
            </button>
          ))}
      </div>
    </div>
  );
}
