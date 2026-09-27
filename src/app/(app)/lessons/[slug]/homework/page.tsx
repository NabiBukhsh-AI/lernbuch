import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getExercises, getLesson } from '@/db/queries/lessons';
import { getSubmissionHistory } from '@/db/queries/homework';
import { ExerciseCard, type ExerciseView } from '@/components/exercise/ExerciseCard';
import { AttemptHistory } from '@/components/exercise/AttemptHistory';
import { DueDateEditor } from '@/components/exercise/DueDateEditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLICY_LABEL: Record<string, string> = {
  on_request: 'Answer available on request',
  after_attempts: 'Answer unlocks after 2 attempts',
  after_due: 'Answer unlocks after the due date',
};

/**
 * Assigned work — Section 10.
 *
 * Section 14: everything is sealed. Hints are staged behind buttons, the
 * solution sits behind a confirm, and neither the hint text nor the solution is
 * serialised into this page — they arrive through Server Actions once asked
 * for. That is what the Phase 5 acceptance criterion checks.
 */
export default async function HomeworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect('/login');

  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const rows = await getExercises(lesson.id, 'homework');
  if (rows.length === 0) {
    return <p className="text-ink-muted">This lesson has no homework block.</p>;
  }

  const history = await getSubmissionHistory(
    user.id,
    rows.map((row) => row.id),
  );

  // The earliest date across the set drives the banner; an override wins.
  const effective = (row: (typeof rows)[number]) => row.dueDateOverride ?? row.dueDate;
  const dueDates = rows.map(effective).filter((d): d is string => Boolean(d));
  const earliest = dueDates.sort()[0] ?? null;

  const authoredDates = rows
    .map((row) => row.dueDate)
    .filter((d): d is string => Boolean(d));
  const authored = authoredDates.sort()[0] ?? null;
  const overridden = rows.some((row) => row.dueDateOverride !== null);

  const items: Array<{ view: ExerciseView; policy: string; dueDate: string | null }> =
    rows.map((row) => ({
      view: {
        id: row.id,
        type: row.type,
        orderIndex: row.orderIndex,
        promptMd: row.promptMd,
        instructionMd: row.instructionMd,
        given: row.given,
        /*
         * Deliberately null. Sending these would put the answer in the HTML,
         * which is exactly what Section 14 forbids.
         */
        solutionMd: null,
        whyMd: null,
        takeawayMd: null,
        tips: [],
        skillTags: row.skillTags,
        points: row.points,
        // One entry per blank for fill_blank and cloze (content/README.md).
        blankCount: Array.isArray(row.answer) ? row.answer.length : 1,
        hintCount: Array.isArray(row.hints) ? row.hints.length : 0,
      },
      policy: row.revealPolicy,
      dueDate: effective(row),
    }));

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Homework
        </h2>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Hausaufgaben</span> · {items.length} exercises
        </p>
      </div>

      {/* Due dates follow the admin's own class; public learners work at their own pace. */}
      {user.role === 'admin' ? (
        <DueDateEditor
          lessonId={lesson.id}
          dueDate={earliest}
          authoredDate={authored}
          overridden={overridden}
        />
      ) : null}

      <p className="mb-5 max-w-[68ch] text-sm text-ink-muted">
        Hints are hidden here on purpose. Try it first — then take a nudge, then the rule,
        then the answer. Taking a hint is recorded but never costs you marks.
      </p>

      <ul className="space-y-4">
        {items.map((item, index) => (
          <li key={item.view.id}>
            <ul>
              <ExerciseCard
                exercise={item.view}
                index={index}
                sealed
                tipsOpenByDefault={false}
              />
            </ul>
            <AttemptHistory
              attempts={history.get(item.view.id) ?? []}
              policyLabel={POLICY_LABEL[item.policy] ?? item.policy}
              dueDate={item.dueDate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
