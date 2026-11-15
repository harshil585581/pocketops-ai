import { useEffect, useState } from 'react';
import { getSession, listSessions, onSessionsChange } from './db';
import type { Session } from './types';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = () =>
      listSessions()
        .then((s) => alive && setSessions(s))
        .catch(() => alive && setSessions([]))
        .finally(() => alive && setLoading(false));
    load();
    const off = onSessionsChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return { sessions, loading };
}

export function useSession(id: string | undefined) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = () => getSession(id).then((s) => alive && setSession(s ?? null));
    load();
    const off = onSessionsChange(load);
    return () => {
      alive = false;
      off();
    };
  }, [id]);
  return session;
}
