import { notFound } from 'next/navigation';
import { getExercises, getLesson } from '@/db/queries/lessons';
import { ExerciseCard, type ExerciseView } from '@/components/exercise/ExerciseCard';

export const runtime = 'nodejs';

/**
 * Replay of the in-class exercises — Section 10.
 *
 * Section 8.6: classwork shows tips, hints and the why panel by default,
 * because classwork is revision rather than assessment. There is no score and
 * no penalty for retrying.
 */
export default async function ClassworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const rows = await getExercises(lesson.id, 'classwork');

  if (rows.length === 0) {
    return <p className="text-ink-muted">This lesson has no classwork block.</p>;
  }

  const items: ExerciseView[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    orderIndex: row.orderIndex,
    promptMd: row.promptMd,
    instructionMd: row.instructionMd,
    given: row.given,
    solutionMd: row.solutionMd,
    whyMd: row.whyMd,
    takeawayMd: row.takeawayMd,
    tips: row.tips,
    skillTags: row.skillTags,
    points: row.points,
    // One entry per blank for fill_blank and cloze (content/README.md).
    blankCount: Array.isArray(row.answer) ? row.answer.length : 1,
  }));

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Classwork
        </h2>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Klassenarbeit</span> · {items.length} exercises
        </p>
        <p className="mt-2 max-w-[68ch] text-sm text-ink-muted">
          Tips and explanations are open by default here. This is revision, not a test —
          retry as often as you like, nothing is scored against you.
        </p>
      </div>

      <ul className="space-y-4">
        {items.map((item, index) => (
          <ExerciseCard key={item.id} exercise={item} index={index} tipsOpenByDefault />
        ))}
      </ul>
    </div>
  );
}
