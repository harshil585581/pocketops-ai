import { Cloud, Cpu, FlaskConical } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import type { InferenceSource, Likelihood, Severity } from '../lib/types';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

export function Logo({ className = 'size-8' }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5BF0B4" />
          <stop offset="1" stopColor="#1FB57E" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="#0E1116" />
      <rect x="8" y="8" width="496" height="496" rx="110" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="8" />
      <path d="M168 360V152h96a68 68 0 0 1 0 136h-96" fill="none" stroke={`url(#${id})`} strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="344" cy="352" r="28" fill="#5BF0B4" />
    </svg>
  );
}

type DotTone = 'local' | 'cloud' | 'warn' | 'danger' | 'muted';
const DOT: Record<DotTone, string> = {
  local: 'text-local bg-local',
  cloud: 'text-cloud bg-cloud',
  warn: 'text-warn bg-warn',
  danger: 'text-danger bg-danger',
  muted: 'text-ink-3 bg-ink-3',
};

export function StatusDot({ tone, pulse }: { tone: DotTone; pulse?: boolean }) {
  return <span className={cx('inline-block size-2 shrink-0 rounded-full', DOT[tone], pulse && 'pulse-dot')} />;
}

const SOURCE = {
  'on-device': { icon: Cpu, verb: 'Generated locally', cls: 'text-local border-local/25 bg-local/8' },
  cloud: { icon: Cloud, verb: 'Generated in cloud', cls: 'text-cloud border-cloud/25 bg-cloud/8' },
  demo: { icon: FlaskConical, verb: 'Example guide', cls: 'text-warn border-warn/25 bg-warn/8' },
} as const;

export function SourceBadge({ source, model, size = 'md' }: { source: InferenceSource; model: string; size?: 'sm' | 'md' }) {
  const s = SOURCE[source];
  const Icon = s.icon;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        s.cls,
        size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-xs',
      )}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.2} />
      <span>{s.verb}</span>
      <span className="opacity-50">·</span>
      <span className="font-mono tracking-tight opacity-90">{model}</span>
    </span>
  );
}

export const sourceTone = (s: InferenceSource): DotTone => (s === 'on-device' ? 'local' : s === 'cloud' ? 'cloud' : 'warn');

const SEV: Record<Severity, { label: string; cls: string }> = {
  low: { label: 'Low risk', cls: 'text-local bg-local/10' },
  medium: { label: 'Moderate risk', cls: 'text-warn bg-warn/10' },
  high: { label: 'High risk', cls: 'text-danger bg-danger/10' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV[severity];
  return (
    <span className={cx('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', s.cls)}>
      <span className="flex items-end gap-[2px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cx('w-[3px] rounded-full bg-current', i > ['low', 'medium', 'high'].indexOf(severity) && 'opacity-25')}
            style={{ height: 5 + i * 3 }}
          />
        ))}
      </span>
      {s.label}
    </span>
  );
}

export function LikelihoodMeter({ value }: { value: Likelihood }) {
  const n = value === 'high' ? 3 : value === 'medium' ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2" title={`${value} likelihood`}>
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1.5 w-3.5 rounded-full', i <= n ? 'bg-ink-2' : 'bg-line-strong')} />
        ))}
      </span>
      <span className="label !tracking-[0.06em]">{value}</span>
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange(v: T): void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-xl border border-line bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap transition duration-200',
              active ? 'border-line bg-surface text-ink shadow-card' : 'border-transparent text-ink-3 hover:text-ink-2',
            )}
          >
            <span className="flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SectionTitle({ icon, children, aside }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
        {icon && <span className="grid size-7 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2">{icon}</span>}
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-surface-2 px-1 font-mono text-[10.5px] text-ink-3">
      {children}
    </kbd>
  );
}
