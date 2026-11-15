import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Session } from '../lib/types';
import { categoryById } from '../lib/categories';
import { relativeTime } from '../lib/format';
import { StatusDot, cx, sourceTone } from './ui';

export function SessionCard({ s, dense }: { s: Session; dense?: boolean }) {
  const cat = categoryById(s.category);
  const Icon = cat.icon;
  const total = s.solution.steps.length;
  const done = s.completedSteps.length;
  const pct = total ? done / total : 0;
  const resolved = total > 0 && done === total;
  return (
    <Link
      to={`/s/${s.id}`}
      className={cx(
        'group card card-hover flex items-center gap-3.5',
        dense ? 'p-3' : 'p-4',
      )}
    >
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', cat.tint)}>
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{s.solution.title}</p>
          {s.sample && (
            <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-px font-mono text-[10px] text-ink-3">EXAMPLE</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-3">{s.problem}</p>
        <div className="mt-2 flex items-center gap-3 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <StatusDot tone={sourceTone(s.source)} />
            {s.source === 'on-device' ? 'On-device' : s.source === 'cloud' ? 'Cloud' : 'Example'}
          </span>
          <span>{relativeTime(s.createdAt)}</span>
          {total > 0 && (
            <span className="ml-auto flex items-center gap-2 sm:ml-0">
              <span className="relative h-1 w-14 overflow-hidden rounded-full bg-line-strong">
                <span
                  className={cx('absolute inset-y-0 left-0 rounded-full', resolved ? 'bg-local' : 'bg-ink-2')}
                  style={{ width: `${pct * 100}%` }}
                />
              </span>
              <span className="font-mono">
                {done}/{total}
              </span>
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="hidden size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink sm:block" />
    </Link>
  );
}
