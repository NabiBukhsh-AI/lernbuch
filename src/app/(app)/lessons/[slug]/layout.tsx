import { notFound } from 'next/navigation';
import { getLesson, getLessonCounts } from '@/db/queries/lessons';
import { currentUser } from '@/lib/session';
import { LessonTabs } from '@/components/shell/LessonTabs';

export const runtime = 'nodejs';

/**
 * Lesson shell — the header and the tabbed nav to the six sub-views.
 *
 * Section 16.4 puts the lesson number, level and date on one line above the
 * tabs, the way a filed index card carries its label along the top.
 */
export default async function LessonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [lesson, user] = await Promise.all([getLesson(slug), currentUser()]);
  // An unpublished lesson is a draft: only the admin can preview it.
  if (!lesson || (!lesson.publish && user?.role !== 'admin')) notFound();

  const counts = await getLessonCounts(lesson.id);

  return (
    <div>
      <header className="mb-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs text-ink-muted">
            Lektion {String(lesson.lessonNumber ?? '—').padStart(2, '0')}
          </span>
          <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">
            {lesson.level}
          </span>
          <time dateTime={lesson.classDate} className="font-mono text-xs text-ink-muted">
            {lesson.classDate}
          </time>
          {!lesson.publish ? (
            <span className="rounded-sm bg-warn-soft px-1.5 py-0.5 font-mono text-xs text-warn">
              Draft, hidden from learners
            </span>
          ) : null}
          {lesson.durationMin ? (
            <span className="font-mono text-xs text-ink-muted">
              {lesson.durationMin} min
            </span>
          ) : null}
        </div>

        <h1 className="mt-1 max-w-[68ch] font-display text-[length:var(--text-xl)] font-semibold leading-tight">
          {lesson.title}
        </h1>
        {lesson.subtitle ? (
          <p className="mt-1 max-w-[68ch] text-ink-muted">{lesson.subtitle}</p>
        ) : null}
      </header>

      <div className="mt-4">
        <LessonTabs slug={slug} counts={counts} />
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
