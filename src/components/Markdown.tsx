import { Fragment, type ReactNode } from 'react';
import { cx } from './ui';

/** Inline markdown: **bold**, *italic*, `code`. Rendered as React elements (no HTML injection). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++} className="font-semibold text-ink">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Inline-only markdown for short strings (step titles, details, list items). */
export function Inline({ text }: { text: string }) {
  return <>{inline(text)}</>;
}

/** Minimal, safe markdown for AI answers: paragraphs, bullet and numbered lists, inline emphasis. */
export function Markdown({ text, className, caret }: { text: string; className?: string; caret?: boolean }) {
  const blocks: { kind: 'p' | 'ul' | 'ol'; lines: string[] }[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const kind = /^[-*•]\s+/.test(line) ? 'ul' : /^\d+[.)]\s+/.test(line) ? 'ol' : 'p';
    const content = line.replace(/^[-*•]\s+|^\d+[.)]\s+/, '');
    const prev = blocks[blocks.length - 1];
    if (prev && prev.kind === kind && (kind !== 'p' || prev.lines.length)) prev.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }
  const visible = blocks.filter((b) => b.lines.length);
  return (
    <div className={cx('space-y-2.5 text-[15.5px] leading-relaxed text-pretty text-ink', className)}>
      {visible.map((b, i) => {
        const isLast = i === visible.length - 1;
        const tail = caret && isLast ? <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse rounded-full bg-local" /> : null;
        if (b.kind === 'p')
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && ' '}
                  {inline(l)}
                </Fragment>
              ))}
              {tail}
            </p>
          );
        const List = b.kind === 'ul' ? 'ul' : 'ol';
        return (
          <List key={i} className="space-y-1.5">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-2.5">
                {b.kind === 'ul' ? (
                  <span className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-ink-3" />
                ) : (
                  <span className="mt-0.5 font-mono text-[12px] text-ink-3">{j + 1}.</span>
                )}
                <span>
                  {inline(l)}
                  {j === b.lines.length - 1 && tail}
                </span>
              </li>
            ))}
          </List>
        );
      })}
      {!visible.length && caret && <span className="inline-block h-[1.05em] w-[2px] animate-pulse rounded-full bg-local" />}
    </div>
  );
}
