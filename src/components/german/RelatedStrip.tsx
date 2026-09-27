import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export type RelatedPoint = {
  id: string;
  title: string;
  lessonId: string;
  lessonNumber: number | null;
  /** True when the related point was taught in an earlier lesson. */
  earlier: boolean;
};

/**
 * "You also saw this in Lektion 1" — Lektion 02's instruction block item 5.
 *
 * Two points can describe the same table at different depths. The strip says
 * which, and in which direction: a rule met earlier reads as revision, a rule
 * met later reads as where it is going next. Those are different messages and
 * the copy changes accordingly.
 */
export function RelatedStrip({ related }: { related: RelatedPoint[] }) {
  if (related.length === 0) return null;

  return (
    <ul className="mt-4 space-y-1.5">
      {related.map((point) => (
        <li key={point.id}>
          <Link
            href={`/lessons/${point.lessonId}/grammar#${point.id.split(':').pop()}`}
            className="inline-flex flex-wrap items-center gap-1.5 rounded-sm border border-rule bg-paper px-3 py-1.5 text-sm hover:border-accent"
          >
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              {point.earlier ? 'You also saw this in' : 'This comes back in'} Lektion{' '}
              {String(point.lessonNumber ?? '—').padStart(2, '0')}
            </span>
            <span lang="de" className="font-serif text-accent">
              {point.title}
            </span>
            <ArrowUpRight aria-hidden className="size-3 text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
