import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BookMarked, CheckCircle2, Cloud, Cpu, Download, Gauge, Menu, Plus, Search, X } from 'lucide-react';
import { useEngine } from '../state/engine';
import { usePwa } from '../state/pwa';
import { Logo, StatusDot, cx } from './ui';
import { useSessions } from '../lib/useSessions';
import { useSync } from '../lib/sync';
import { categoryById } from '../lib/categories';
import { dayGroup } from '../lib/format';
import type { Session } from '../lib/types';

/** Compact live status: where the next request will run, plus Nano and sync state. */
export function EngineStatus({ compact }: { compact?: boolean }) {
  const { online, local, route } = useEngine();
  const sync = useSync();
  const routeTone = route.target === 'on-device' ? 'local' : route.target === 'cloud' ? 'cloud' : 'danger';
  const routeLabel = route.target === 'on-device' ? 'On-device' : route.target === 'cloud' ? 'Cloud' : 'Offline';
  if (compact) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-2.5 py-1 text-xs font-medium text-ink-2">
        <StatusDot tone={routeTone} pulse={route.target !== 'none'} />
        {routeLabel}
      </span>
    );
  }
  const nanoTone = local === 'available' ? 'local' : local === 'downloading' ? 'warn' : 'muted';
  const syncTone = sync.status === 'synced' ? 'local' : sync.status === 'error' ? 'danger' : sync.status === 'disabled' ? 'muted' : 'warn';
  const rows: [string, 'local' | 'cloud' | 'warn' | 'danger' | 'muted', string, boolean?][] = [
    ['Network', online ? 'local' : 'danger', online ? 'Online' : 'Offline'],
    ['Gemini Nano', nanoTone, local === 'available' ? 'Ready' : local === 'downloading' ? 'Downloading' : local === 'downloadable' ? 'Not downloaded' : 'Unavailable'],
    ['Sync', syncTone, { disabled: 'Off', connecting: 'Connecting', syncing: 'Syncing', synced: 'Synced', offline: 'Queued', error: 'Error' }[sync.status]],
    ['Routing to', routeTone, route.target === 'none' ? 'Unavailable' : routeLabel, true],
  ];
  return (
    <NavLink to="/engine" className="group block rounded-xl border border-line bg-surface-2/60 p-3 transition hover:border-line-strong">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">Engine</span>
        <span className="text-[11px] text-ink-3 transition group-hover:text-ink-2">Details →</span>
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {rows.map(([label, tone, value, pulse]) => (
          <li key={label} className="flex items-center justify-between">
            <span className="text-ink-2">{label}</span>
            <span className={cx('flex items-center gap-1.5 font-medium', tone === 'danger' && label === 'Routing to' && 'text-danger')}>
              <StatusDot tone={tone} pulse={pulse && route.target !== 'none'} />
              {value}
            </span>
          </li>
        ))}
      </ul>
    </NavLink>
  );
}

function ThreadItem({ s, active }: { s: Session; active: boolean }) {
  const cat = categoryById(s.category);
  const Icon = cat.icon;
  const replies = (s.turns ?? []).filter((t) => t.role === 'assistant').length;
  return (
    <Link
      to={`/s/${s.id}`}
      className={cx(
        'group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors',
        active ? 'bg-surface shadow-card ring-1 ring-line' : 'hover:bg-surface-2/80',
      )}
    >
      <span className={cx('grid size-7 shrink-0 place-items-center rounded-lg', cat.tint)}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[13px]', active ? 'font-medium text-ink' : 'text-ink-2 group-hover:text-ink')}>{s.solution.title}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
          {s.status === 'resolved' ? (
            <span className="flex items-center gap-1 text-local">
              <CheckCircle2 className="size-3" /> Resolved
            </span>
          ) : s.sample ? (
            <span>Example</span>
          ) : (
            <span className="flex items-center gap-1">
              {s.source === 'on-device' ? <Cpu className="size-3" /> : <Cloud className="size-3" />}
              {s.source === 'on-device' ? 'On-device' : 'Cloud'}
            </span>
          )}
          {replies > 0 && <span>· {replies + 1} replies</span>}
        </span>
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?(): void }) {
  const { sessions } = useSessions();
  const { id } = useParams();
  const { pathname } = useLocation();
  const activeId = id ?? pathname.match(/^\/s\/([^/]+)/)?.[1];
  const { canInstall, install } = usePwa();
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = [...sessions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((s) => !query || `${s.solution.title} ${s.problem}`.toLowerCase().includes(query));
    const map = new Map<string, Session[]>();
    list.forEach((s) => {
      const g = dayGroup(s.updatedAt);
      map.set(g, [...(map.get(g) ?? []), s]);
    });
    return [...map.entries()];
  }, [sessions, q]);

  return (
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate?.()}>
      <div className="flex items-center gap-2.5 px-2 pt-1 pb-4">
        <Logo className="size-8" />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">PocketOps</p>
          <p className="font-mono text-[10.5px] tracking-wide text-ink-3">OFFLINE-FIRST AI</p>
        </div>
      </div>

      <Link to="/" className="btn-brand h-10 w-full justify-start rounded-xl px-3">
        <Plus className="size-4" strokeWidth={2.4} /> New diagnosis
      </Link>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          className="h-9 w-full rounded-lg border border-line bg-surface/80 pr-2 pl-8 text-[13px] placeholder:text-ink-3 focus:border-line-strong focus:outline-none"
        />
      </div>

      <nav aria-label="Conversations" className="no-scrollbar -mx-1 mt-4 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px] text-ink-3">{q ? 'No matching conversations' : 'Your conversations will appear here.'}</p>
        ) : (
          groups.map(([label, list]) => (
            <div key={label}>
              <p className="label mb-1 px-2">{label}</p>
              <div className="space-y-0.5">
                {list.map((s) => (
                  <ThreadItem key={s.id} s={s} active={s.id === activeId} />
                ))}
              </div>
            </div>
          ))
        )}
      </nav>

      <div className="space-y-2 border-t border-line pt-3">
        <div className="grid grid-cols-2 gap-1">
          <NavLink
            to="/saved"
            className={({ isActive }) =>
              cx('flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition', isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-surface-2')
            }
          >
            <BookMarked className="size-4" /> All guides
          </NavLink>
          <NavLink
            to="/engine"
            className={({ isActive }) =>
              cx('flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition', isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-surface-2')
            }
          >
            <Gauge className="size-4" /> Engine
          </NavLink>
        </div>
        <EngineStatus />
        {canInstall && (
          <button onClick={install} className="btn-secondary h-9 w-full text-[13px]">
            <Download className="size-4" /> Install app
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-line bg-surface/75 px-3 py-4 backdrop-blur-xl lg:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);

  return (
    <>
      <header className="glass safe-top sticky top-0 z-30 border-b border-line lg:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          <button onClick={() => setOpen(true)} aria-label="Open conversations" className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
            <Menu className="size-5" />
          </button>
          <Link to="/" className="flex flex-1 items-center gap-2">
            <Logo className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight">PocketOps</span>
          </Link>
          <NavLink to="/engine" aria-label="Engine status">
            <EngineStatus compact />
          </NavLink>
          <Link to="/" aria-label="New diagnosis" className="btn-brand size-9 !rounded-lg !px-0">
            <Plus className="size-4.5" strokeWidth={2.4} />
          </Link>
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="safe-top absolute inset-y-0 left-0 w-[86%] max-w-80 border-r border-line bg-canvas px-3 py-4 shadow-pop"
            >
              <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-4 right-3 grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2">
                <X className="size-4.5" />
              </button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
