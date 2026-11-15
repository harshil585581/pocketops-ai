import { AlignLeft, ArrowRight, BookMarked, Cloud, Cpu, Wifi, WifiOff } from 'lucide-react';
import { useEngine } from '../state/engine';
import { useRuntimeConfig } from '../lib/remoteConfig';
import { cx } from './ui';

type RowKey = 'online-local' | 'online-long' | 'online-nolocal' | 'offline-local' | 'offline-none';

const ROWS: {
  key: RowKey;
  online: boolean;
  cond: string;
  condIcon: typeof Cpu;
  to: string;
  sdk: string;
  icon: typeof Cpu;
  tone: string;
}[] = [
  { key: 'online-local', online: true, cond: 'Nano ready', condIcon: Cpu, to: 'On-device', sdk: 'PREFER_ON_DEVICE', icon: Cpu, tone: 'text-local' },
  { key: 'online-long', online: true, cond: 'Long problem', condIcon: AlignLeft, to: 'Cloud first', sdk: 'PREFER_IN_CLOUD', icon: Cloud, tone: 'text-cloud' },
  { key: 'online-nolocal', online: true, cond: 'No Nano', condIcon: Cpu, to: 'Cloud fallback', sdk: 'PREFER_ON_DEVICE', icon: Cloud, tone: 'text-cloud' },
  { key: 'offline-local', online: false, cond: 'Nano ready', condIcon: Cpu, to: 'On-device', sdk: 'ONLY_ON_DEVICE', icon: Cpu, tone: 'text-local' },
  { key: 'offline-none', online: false, cond: 'No Nano', condIcon: Cpu, to: 'Saved guidance', sdk: 'No AI — related guides', icon: BookMarked, tone: 'text-warn' },
];

export function RoutingMatrix({ className, problemLength = 0 }: { className?: string; problemLength?: number }) {
  const { online, local, mode } = useEngine();
  const { longProblemChars } = useRuntimeConfig();
  const localReady = local === 'available';
  const active: RowKey = online
    ? problemLength >= longProblemChars
      ? 'online-long'
      : localReady
        ? 'online-local'
        : 'online-nolocal'
    : localReady
      ? 'offline-local'
      : 'offline-none';

  return (
    <div className={cx('card overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="label">Hybrid routing</span>
        {mode !== 'auto' ? (
          <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn">
            Override: {mode === 'local-only' ? 'On-device only' : 'Cloud only'}
          </span>
        ) : (
          <span className="font-mono text-[10.5px] text-ink-3">Firebase AI Logic</span>
        )}
      </div>
      <ul className="divide-y divide-line">
        {ROWS.map((r) => {
          const isActive = mode === 'auto' && r.key === active;
          const Icon = r.icon;
          const CondIcon = r.condIcon;
          return (
            <li key={r.key} className="relative">
              {isActive && <span className="absolute inset-0 bg-surface-2" />}
              {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-local" />}
              <div className={cx('relative flex items-center gap-3 px-4 py-2.5 transition-opacity', !isActive && 'opacity-55')}>
                <div className="flex w-[100px] shrink-0 flex-col gap-1 text-[12px] text-ink-2">
                  <span className="flex items-center gap-1.5">
                    {r.online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                    {r.online ? 'Online' : 'Offline'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CondIcon className="size-3.5" />
                    {r.cond}
                  </span>
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className={cx('flex items-center gap-1.5 text-[13px] font-medium', r.tone)}>
                    <Icon className="size-3.5" />
                    {r.to}
                  </p>
                  <p className="truncate font-mono text-[10.5px] text-ink-3">{r.sdk}</p>
                </div>
                {isActive && <span className="label !text-local">Now</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-ink-3">
        Problems over {longProblemChars} characters go to the cloud first. Deep analysis always uses <span className="font-mono">ONLY_IN_CLOUD</span>.
      </p>
    </div>
  );
}
