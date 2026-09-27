'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * The six sub-views of a lesson — Section 10.
 *
 * Labels are English (the learner reads the interface in English), with the
 * German term from Appendix B carried as the title so the vocabulary is still
 * in front of them without standing between them and the navigation.
 */
const TABS = [
  { segment: '', label: 'Overview', de: 'Überblick' },
  { segment: 'vocabulary', label: 'Vocabulary', de: 'Wortschatz' },
  { segment: 'grammar', label: 'Grammar', de: 'Grammatik' },
  { segment: 'classwork', label: 'Classwork', de: 'Klassenarbeit' },
  { segment: 'homework', label: 'Homework', de: 'Hausaufgaben' },
  { segment: 'quiz', label: 'Quiz', de: 'Quiz' },
] as const;

export function LessonTabs({
  slug,
  counts,
}: {
  slug: string;
  counts?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const base = `/lessons/${slug}`;

  return (
    <nav
      aria-label="Lesson sections"
      className="-mx-4 overflow-x-auto border-b border-rule px-4 md:-mx-8 md:px-8"
    >
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const active = pathname === href;
          const badge = tab.segment ? counts?.[tab.segment] : undefined;

          return (
            <li key={tab.segment || 'overview'}>
              <Link
                href={href}
                title={tab.de}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'border-accent font-semibold text-accent'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {tab.label}
                {typeof badge === 'number' && badge > 0 ? (
                  <span className="font-mono text-xs text-ink-muted">{badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
