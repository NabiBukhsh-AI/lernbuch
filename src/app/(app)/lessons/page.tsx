import Link from 'next/link';
import { listLessons } from '@/db/queries/lessons';

export const runtime = 'nodejs';

export const metadata = { title: 'Lessons' };

/** All lessons, newest first — Section 10. */
export default async function LessonsPage() {
  const rows = await listLessons();

  if (rows.length === 0) {
    return (
      <div className="prose-de">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Lessons
        </h1>
        {/* Section 10.1: empty states are instructional, not decorative. */}
        <div className="mt-6 rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">No lessons yet</h2>
          <p className="mt-2 text-ink-muted">
            Lessons appear here as soon as they are published.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-[length:var(--text-xl)] font-semibold">Lessons</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {rows.length} {rows.length === 1 ? 'lesson' : 'lessons'}, newest first
      </p>

      <ul className="mt-6 space-y-3">
        {rows.map((lesson) => (
          <li key={lesson.slug}>
            <Link
              href={`/lessons/${lesson.slug}`}
              className="block rounded-sm border border-rule bg-card p-4 transition-colors hover:border-accent"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-ink-muted">
                  Lektion {String(lesson.lessonNumber ?? '—').padStart(2, '0')}
                </span>
                <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">
                  {lesson.level}
                </span>
                <time
                  dateTime={lesson.classDate}
                  className="font-mono text-xs text-ink-muted"
                >
                  {lesson.classDate}
                </time>
              </div>

              <h2 className="mt-1.5 font-display text-base font-semibold">
                {lesson.title}
              </h2>
              {lesson.subtitle ? (
                <p className="mt-0.5 text-sm text-ink-muted">{lesson.subtitle}</p>
              ) : null}

              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-muted">
                <div className="flex gap-1">
                  <dt>Vocabulary</dt>
                  <dd className="text-ink">{lesson.vocabCount}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Grammar</dt>
                  <dd className="text-ink">{lesson.grammarCount}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Classwork</dt>
                  <dd className="text-ink">{lesson.classworkCount}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Homework</dt>
                  <dd className="text-ink">{lesson.homeworkCount}</dd>
                </div>
              </dl>

              {lesson.topics.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {lesson.topics.map((topic) => (
                    <li
                      key={topic}
                      lang="de"
                      className="rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
