import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Repeat, Target } from 'lucide-react';
import { listLessons } from '@/db/queries/lessons';
import { getLastStudiedLesson, getStreak, getWeakSkills } from '@/db/queries/progress';
import { getDueCount } from '@/db/queries/review';
import { buttonVariants } from '@/components/ui/button';
import { Stat } from '@/components/ui/stat';
import { currentUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Where you are, and the one thing to do next. */
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const [lessonList, due, streak, weak, lastSlug] = await Promise.all([
    listLessons(),
    getDueCount(user.id),
    getStreak(user.id),
    getWeakSkills(user.id),
    getLastStudiedLesson(user.id),
  ]);

  const firstName = user.displayName.split(' ')[0];

  if (lessonList.length === 0) {
    return (
      <div className="max-w-[68ch]">
        <h1 className="text-[length:var(--text-xl)] font-semibold">Hallo, {firstName}</h1>
        {/* Empty states are instructional: this is the normal state of a new install. */}
        <div className="mt-6 rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">No lessons yet</h2>
          {user.role === 'admin' ? (
            <p className="mt-2 font-serif text-ink-muted">
              Upload a lesson file under{' '}
              <Link
                href="/admin/lessons"
                className="text-accent underline underline-offset-4"
              >
                Admin → Lessons
              </Link>{' '}
              and it appears here for every learner.
            </p>
          ) : (
            <p className="mt-2 font-serif text-ink-muted">
              The first lesson has not been published yet. Check back soon.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Newest first, so a learner with no history starts at the oldest lesson.
  const resumed = lessonList.find((lesson) => lesson.slug === lastSlug);
  const sessionSize = Math.min(due, user.dailyGoal);
  const reviewLabel =
    due > 0
      ? `Review ${sessionSize} ${sessionSize === 1 ? 'card' : 'cards'}`
      : 'Open review';
  const next = resumed ?? lessonList.at(-1)!;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[length:var(--text-xl)] font-semibold">Hallo, {firstName}</h1>
        <p className="font-serif text-ink-muted">
          {due > 0
            ? `${due} ${due === 1 ? 'card is' : 'cards are'} due for review.`
            : 'Nothing is due for review right now.'}
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Link
          href={`/lessons/${next.slug}`}
          className="group rounded-sm border border-rule bg-card p-6 transition-colors hover:border-accent"
        >
          <p className="font-mono text-xs uppercase tracking-wider text-accent">
            {resumed ? 'Continue where you left off' : 'Start here'}
          </p>
          <p className="mt-3 font-mono text-xs text-ink-muted">
            Lektion {String(next.lessonNumber ?? '—').padStart(2, '0')} · {next.level}
          </p>
          <h2 className="mt-1 text-[length:var(--text-lg)] font-semibold">
            {next.title}
          </h2>
          {next.subtitle ? (
            <p className="mt-1 font-serif text-ink-muted">{next.subtitle}</p>
          ) : null}
          <p className="mt-4 font-mono text-xs text-ink-muted">
            {next.vocabCount} words · {next.grammarCount} rules · {next.classworkCount}{' '}
            classwork · {next.homeworkCount} homework
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            Open lesson
            <ArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>

        <div className="flex flex-col justify-between rounded-sm border border-rule bg-card p-6">
          <div>
            <Repeat aria-hidden className="size-5 text-accent" />
            <h2 className="mt-3 text-base font-semibold">Daily review</h2>
            <p className="mt-1 font-serif text-sm text-ink-muted">
              Words and rules come back just before you would forget them.
            </p>
          </div>
          <Link
            href="/review"
            className={buttonVariants({
              variant: due > 0 ? 'default' : 'outline',
              className: 'mt-5 w-full',
            })}
          >
            {reviewLabel}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Day streak"
          value={String(streak.current)}
          note={streak.current === 1 ? 'day in a row' : 'days in a row'}
        />
        <Stat
          label="This week"
          value={`${streak.weekMinutes}`}
          note="minutes of review"
        />
        <Stat
          label="Weak skills"
          value={String(weak.length)}
          note={weak.length ? 'worth a drill' : 'none flagged'}
          href="/progress"
        />
      </section>

      {weak.length > 0 ? (
        <section className="rounded-sm border border-warn/40 bg-warn-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target aria-hidden className="size-5 text-warn" />
              <h2 className="text-base font-semibold">Worth another look</h2>
            </div>
            <Link
              href={`/drill?tags=${encodeURIComponent(weak.map((s) => s.skillTag).join(','))}`}
              className={buttonVariants({ size: 'sm' })}
            >
              Drill these
            </Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {weak.slice(0, 8).map((skill) => (
              <li
                key={skill.skillTag}
                className="rounded-sm border border-rule bg-card px-2 py-1 font-mono text-xs"
              >
                {skill.skillTag}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[length:var(--text-lg)] font-semibold">Lessons</h2>
          <Link
            href="/lessons"
            className="text-sm text-accent underline underline-offset-4"
          >
            All lessons
          </Link>
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lessonList.slice(0, 6).map((lesson) => (
            <li key={lesson.slug}>
              <Link
                href={`/lessons/${lesson.slug}`}
                className="block h-full rounded-sm border border-rule bg-card p-4 transition-colors hover:border-accent"
              >
                <p className="font-mono text-xs text-ink-muted">
                  Lektion {String(lesson.lessonNumber ?? '—').padStart(2, '0')} ·{' '}
                  {lesson.level}
                </p>
                <h3 className="mt-1 font-semibold">{lesson.title}</h3>
                {lesson.subtitle ? (
                  <p className="mt-2 line-clamp-2 font-serif text-sm text-ink-muted">
                    {lesson.subtitle}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
