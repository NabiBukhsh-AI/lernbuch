import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/utils';
import { MainNav } from './MainNav';
import { ThemeToggle } from './ThemeToggle';

export function Header({
  displayName,
  targetLevel,
  isAdmin,
}: {
  displayName: string;
  targetLevel: string;
  isAdmin: boolean;
}) {
  return (
    <header className="border-b border-rule">
      <div className="flex items-center justify-between gap-4 px-4 pt-3 md:px-6">
        <Link
          href="/"
          className="min-w-0 font-mono text-xs uppercase tracking-[0.2em] text-ink-muted hover:text-ink"
        >
          {APP_NAME}
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <span
            className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent"
            title="Target level"
          >
            {targetLevel}
          </span>

          {isAdmin ? (
            <Link
              href="/admin"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-sm px-2 text-sm text-ink-muted hover:bg-accent-soft hover:text-ink"
            >
              <ShieldCheck aria-hidden className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          ) : null}

          <ThemeToggle />

          <Link
            href="/settings"
            className="hidden max-w-40 truncate rounded-sm px-2 py-1 text-sm hover:bg-accent-soft sm:inline"
            title="Account settings"
          >
            {displayName}
          </Link>

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut aria-hidden className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="px-3 pb-1 md:px-5">
        <MainNav />
      </div>
    </header>
  );
}
