import Link from 'next/link';

/** Empty and error states are instructional, not decorative. */
export default function NotFound() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
        Not found
      </h1>
      <p className="mt-2 font-serif text-ink-muted">
        There is no page here. If you were expecting a lesson, it may not have been
        published yet.
      </p>
      <ul className="mt-4 flex flex-wrap gap-3 font-mono text-sm">
        <li>
          <Link href="/lessons" className="text-accent underline underline-offset-2">
            All lessons
          </Link>
        </li>
        <li>
          <Link href="/" className="text-accent underline underline-offset-2">
            Dashboard
          </Link>
        </li>
      </ul>
    </div>
  );
}
