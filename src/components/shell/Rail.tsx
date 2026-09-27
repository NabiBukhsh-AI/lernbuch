import Link from 'next/link';
import { listLessonRail } from '@/db/queries/lessons';

/**
 * Left margin rail — Section 16.4.
 *
 * Lesson numbers stack vertically like tabs on filed index cards. On mobile it
 * becomes a horizontal scroll strip.
 */
export async function Rail() {
  // Published lessons only: an unpublished draft stays with the admin.
  const rows = await listLessonRail();

  return (
    <nav
      aria-label="Lessons"
      className="flex shrink-0 gap-1 overflow-x-auto bg-rail p-2 text-rail-ink md:w-16 md:flex-col md:overflow-x-visible md:overflow-y-auto md:p-3"
    >
      <Link
        href="/"
        className="flex size-11 shrink-0 items-center justify-center rounded-sm font-mono text-sm font-semibold tracking-widest hover:bg-white/10 md:mb-2"
      >
        DE
      </Link>

      {rows.map((lesson) => (
        <Link
          key={lesson.slug}
          href={`/lessons/${lesson.slug}`}
          title={lesson.title}
          className="flex size-11 shrink-0 items-center justify-center rounded-sm font-mono text-sm hover:bg-white/10"
        >
          {String(lesson.lessonNumber ?? '·').padStart(2, '0')}
        </Link>
      ))}

      {rows.length === 0 ? (
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center font-mono text-sm text-rail-ink/40"
        >
          —
        </span>
      ) : null}
    </nav>
  );
}
