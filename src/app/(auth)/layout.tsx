import Link from 'next/link';
import { Noun } from '@/components/german/Noun';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { APP_NAME } from '@/lib/utils';

export const runtime = 'nodejs';

/** Sign in and sign up: a quiet form beside a sample of what the app teaches. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-rule bg-card p-10 md:flex">
        <Link
          href="/welcome"
          className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted hover:text-ink"
        >
          {APP_NAME}
        </Link>

        <div
          className="flex flex-col items-start gap-3 font-serif text-[length:var(--text-lg)]"
          lang="de"
        >
          <Noun de="Tisch" article="der" plural="Tische" />
          <Noun de="Lampe" article="die" plural="Lampen" />
          <Noun de="Buch" article="das" plural="Bücher" />
          <p className="max-w-sm pt-4 text-sm text-ink-muted" lang="en">
            Never a bare noun. Every word arrives with its article and its plural, colour
            coded, so the gender is learned with the word instead of after it.
          </p>
        </div>

        <p className="font-mono text-xs text-ink-muted">A1 → B1, one lesson at a time</p>
      </aside>

      <div className="flex flex-col bg-paper px-4 py-6">
        <div className="flex items-center justify-between md:justify-end">
          <Link
            href="/welcome"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted md:hidden"
          >
            {APP_NAME}
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </main>
  );
}
