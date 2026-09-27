import Link from 'next/link';

/** A labelled figure. With `href` the whole tile is the link. */
export function Stat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-[length:var(--text-xl)] font-semibold">
        {value}
      </p>
      <p className="font-serif text-sm text-ink-muted">{note}</p>
    </>
  );

  const tile = 'block rounded-sm border border-rule bg-card p-4';
  return href ? (
    <Link href={href} className={`${tile} transition-colors hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={tile}>{body}</div>
  );
}
