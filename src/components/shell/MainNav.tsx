'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Global navigation.
 *
 * The left rail lists lessons; everything that is not a lesson lives here. Up
 * to now these routes existed but could only be reached by typing the URL,
 * which made half the app effectively invisible.
 *
 * Cheatsheets has a permanent entry by request: the two decision trees are the
 * pages returned to most often, and burying them inside Lektion 02 would mean
 * navigating a lesson to answer a question about a different one.
 */
const LINKS = [
  { href: '/', label: 'Overview', exact: true },
  { href: '/lessons', label: 'Lessons' },
  { href: '/review', label: 'Review' },
  { href: '/cheatsheets', label: 'Cheatsheets' },
  { href: '/vocabulary', label: 'Vocabulary' },
  { href: '/grammar', label: 'Grammar' },
  { href: '/progress', label: 'Progress' },
  { href: '/settings', label: 'Settings' },
] as const;

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max items-center gap-0.5">
        {LINKS.map((link) => {
          const active =
            'exact' in link && link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-sm px-2.5 text-sm transition-colors',
                  active
                    ? 'bg-accent-soft font-semibold text-accent'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
