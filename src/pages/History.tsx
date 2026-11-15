import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookMarked, Cloud, Cpu, FlaskConical, Plus, Search, X } from 'lucide-react';
import { SessionCard } from '../components/SessionCard';
import { Segmented } from '../components/ui';
import { dayGroup, tokenize } from '../lib/format';
import type { InferenceSource } from '../lib/types';
import { useSessions } from '../lib/useSessions';

type Filter = 'all' | InferenceSource;

export default function History() {
  const { sessions, loading } = useSessions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c = { all: sessions.length, 'on-device': 0, cloud: 0, demo: 0 } as Record<Filter, number>;
    sessions.forEach((s) => c[s.source]++);
    return c;
  }, [sessions]);

  const groups = useMemo(() => {
    const terms = tokenize(query);
    const q = query.trim().toLowerCase();
    const list = sessions.filter((s) => {
      if (filter !== 'all' && s.source !== filter) return false;
      if (!q) return true;
      const hay = `${s.problem} ${s.solution.title} ${s.solution.summary} ${s.category}`.toLowerCase();
      return hay.includes(q) || (terms.length > 0 && terms.every((t) => hay.includes(t)));
    });
    const map = new Map<string, typeof list>();
    list.forEach((s) => {
      const g = dayGroup(s.createdAt);
      map.set(g, [...(map.get(g) ?? []), s]);
    });
    return [...map.entries()];
  }, [sessions, query, filter]);

  const total = groups.reduce((n, [, l]) => n + l.length, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-12">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] sm:text-[34px]">Saved guidance</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">Stored on this device and available offline.</p>
        </div>
        <Link to="/" className="btn-primary hidden h-9 sm:inline-flex">
          <Plus className="size-4" /> New diagnosis
        </Link>
      </header>

      {sessions.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problems, causes, devices…"
              aria-label="Search saved guidance"
              className="h-11 w-full rounded-xl border border-line bg-surface pr-10 pl-10 text-[15px] shadow-card transition placeholder:text-ink-3 focus:border-line-strong focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="no-scrollbar overflow-x-auto">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              className="min-w-max"
              options={[
                { value: 'all', label: <>All <Count n={counts.all} /></> },
                { value: 'on-device', label: <><Cpu className="size-3.5" /> On-device <Count n={counts['on-device']} /></> },
                { value: 'cloud', label: <><Cloud className="size-3.5" /> Cloud <Count n={counts.cloud} /></> },
                ...(counts.demo ? [{ value: 'demo' as const, label: <><FlaskConical className="size-3.5" /> Examples <Count n={counts.demo} /></> }] : []),
              ]}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[92px] !rounded-2xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState />
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
          <Search className="mx-auto size-5 text-ink-3" />
          <p className="mt-3 text-sm font-medium">No matches</p>
          <p className="mt-1 text-[13px] text-ink-3">Try different words or clear the filter.</p>
          <button
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="btn-secondary mt-4 h-8 text-[13px]"
          >
            Reset
          </button>
        </div>
      ) : (
        <div className="space-y-7">
            {groups.map(([label, list]) => (
              <section key={label}>
                <h2 className="label mb-2.5">{label}</h2>
                <div className="space-y-2">
                  {list.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.2), type: 'spring', stiffness: 320, damping: 30 }}
                    >
                      <SessionCard s={s} />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

const Count = ({ n }: { n: number }) => <span className="font-mono text-[11px] text-ink-3">{n}</span>;

function EmptyState() {
  return (
    <div className="card relative overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(28rem_14rem_at_50%_0%,var(--glow),transparent)]" />
      <div className="relative">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-surface-2 text-ink-2">
          <BookMarked className="size-6" strokeWidth={1.6} />
        </span>
        <h2 className="mt-5 text-lg font-semibold tracking-tight">Nothing saved yet</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-ink-2">
          Every diagnosis is saved here automatically, so the guidance is still there when you lose signal.
        </p>
        <Link to="/" className="btn-primary mt-6">
          <Plus className="size-4" /> Start a diagnosis
        </Link>
      </div>
    </div>
  );
}
