import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDrillExercises } from '@/db/queries/progress';
import { ExerciseCard, type ExerciseView } from '@/components/exercise/ExerciseCard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Drill' };

/**
 * The "Drill these" target — Section 15.
 *
 * Section 15 describes this as assembling a `kind='review'` quiz. It is built
 * here as a page over the matching exercises instead, because an exercise row
 * carries a single `quizId`: attaching existing exercises to a new quiz would
 * mean either moving them out of their own lesson or duplicating every row,
 * and a throwaway drill would then leave permanent content behind. The
 * behaviour the criterion asks for — pulling only exercises whose skill tags
 * intersect the weak set, from all lessons — is unchanged.
 */
export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const raw = typeof params.tags === 'string' ? params.tags : '';
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const rows = tags.length ? await getDrillExercises(tags) : [];

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
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">Drill</h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          {tags.length} {tags.length === 1 ? 'skill' : 'skills'} · {items.length}{' '}
          {items.length === 1 ? 'exercise' : 'exercises'}
        </p>
      </div>

      {tags.length > 0 ? (
        <ul className="mb-5 flex flex-wrap gap-2" aria-label="Skills being drilled">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-sm border border-accent bg-accent-soft px-2 py-1 font-mono text-xs text-accent"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">Nothing to drill</h2>
          <p className="mt-2 max-w-[68ch] text-ink-muted">
            {tags.length === 0
              ? 'No skills were selected.'
              : 'No exercise in any lesson carries these skill tags yet.'}{' '}
            <Link href="/progress" className="text-accent underline underline-offset-2">
              Back to progress
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item, index) => (
            <ExerciseCard key={item.id} exercise={item} index={index} tipsOpenByDefault />
          ))}
        </ul>
      )}
    </div>
  );
}
