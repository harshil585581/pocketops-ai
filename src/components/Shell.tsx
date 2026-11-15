import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookMarked, Download, Gauge, Sparkles } from 'lucide-react';
import { useEngine } from '../state/engine';
import { usePwa } from '../state/pwa';
import { Logo, StatusDot, cx } from './ui';
import { useSessions } from '../lib/useSessions';
import { useSync } from '../lib/sync';

const NAV = [
  { to: '/', label: 'Diagnose', icon: Sparkles, end: true },
  { to: '/saved', label: 'Saved', icon: BookMarked },
  { to: '/engine', label: 'Engine', icon: Gauge },
];

function useActive() {
  const { pathname } = useLocation();
  return (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to) || (to === '/saved' && pathname.startsWith('/s/')));
}

export function EngineSummary({ compact }: { compact?: boolean }) {
  const { online, local, route } = useEngine();
  const sync = useSync();
  const localTone = local === 'available' ? 'local' : local === 'downloading' ? 'warn' : 'muted';
  const routeTone = route.target === 'on-device' ? 'local' : route.target === 'cloud' ? 'cloud' : 'danger';
  if (compact) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-2.5 py-1 text-xs font-medium text-ink-2">
        <StatusDot tone={routeTone} pulse={route.target !== 'none'} />
        {route.target === 'on-device' ? 'On-device' : route.target === 'cloud' ? 'Cloud' : 'Offline'}
      </span>
    );
  }
  return (
    <NavLink to="/engine" className="group block rounded-xl border border-line bg-surface-2/60 p-3 transition hover:border-line-strong">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="label">Engine</span>
        <span className="text-[11px] text-ink-3 transition group-hover:text-ink-2">Details →</span>
      </div>
      <ul className="space-y-1.5 text-[13px]">
        <li className="flex items-center justify-between">
          <span className="text-ink-2">Network</span>
          <span className="flex items-center gap-1.5 font-medium">
            <StatusDot tone={online ? 'local' : 'danger'} />
            {online ? 'Online' : 'Offline'}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-ink-2">Gemini Nano</span>
          <span className="flex items-center gap-1.5 font-medium">
            <StatusDot tone={localTone} />
            {local === 'available' ? 'Ready' : local === 'downloading' ? 'Downloading' : local === 'downloadable' ? 'Not downloaded' : 'Unavailable'}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-ink-2">Sync</span>
          <span className="flex items-center gap-1.5 font-medium">
            <StatusDot tone={sync.status === 'synced' ? 'local' : sync.status === 'error' ? 'danger' : sync.status === 'disabled' ? 'muted' : 'warn'} />
            {{ disabled: 'Off', connecting: 'Connecting', syncing: 'Syncing', synced: 'Synced', offline: 'Queued', error: 'Error' }[sync.status]}
          </span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-ink-2">Routing to</span>
          <span className={cx('flex items-center gap-1.5 font-medium', route.target === 'none' && 'text-danger')}>
            <StatusDot tone={routeTone} pulse={route.target !== 'none'} />
            {route.target === 'on-device' ? 'On-device' : route.target === 'cloud' ? 'Cloud' : 'Unavailable'}
          </span>
        </li>
      </ul>
    </NavLink>
  );
}

export function Sidebar() {
  const isActive = useActive();
  const { canInstall, install } = usePwa();
  const { sessions } = useSessions();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-canvas/70 px-3 py-4 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <Logo className="size-8" />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">PocketOps</p>
          <p className="font-mono text-[10.5px] tracking-wide text-ink-3">OFFLINE-FIRST AI</p>
        </div>
      </div>

      <nav className="space-y-0.5" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon, end }) => {
          const active = isActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cx(
                'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors',
                active ? 'text-ink' : 'text-ink-2 hover:bg-surface-2/70 hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg border border-line bg-surface shadow-card"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="relative size-4" strokeWidth={2} />
              <span className="relative flex-1">{label}</span>
              {to === '/saved' && sessions.length > 0 && (
                <span className="relative font-mono text-[11px] text-ink-3">{sessions.length}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2">
        <EngineSummary />
        {canInstall && (
          <button onClick={install} className="btn-secondary w-full">
            <Download className="size-4" /> Install app
          </button>
        )}
      </div>
    </aside>
  );
}

export function MobileHeader() {
  return (
    <header className="glass safe-top sticky top-0 z-30 border-b border-line lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <NavLink to="/" className="flex items-center gap-2">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight">PocketOps</span>
        </NavLink>
        <NavLink to="/engine" aria-label="Engine status">
          <EngineSummary compact />
        </NavLink>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const isActive = useActive();
  return (
    <nav aria-label="Primary" className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-3">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <NavLink key={to} to={to} className="relative flex flex-col items-center justify-center gap-1">
              {active && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute top-0 h-0.5 w-10 rounded-full bg-local"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cx('size-5 transition-colors', active ? 'text-ink' : 'text-ink-3')} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cx('text-[11px] font-medium transition-colors', active ? 'text-ink' : 'text-ink-3')}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
