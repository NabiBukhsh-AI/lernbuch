import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLesson, getLessonCounts, getLessonSections } from '@/db/queries/lessons';
import { Markdown } from '@/components/german/Markdown';
import { PronunciationTrainer } from '@/components/german/PronunciationTrainer';

export const runtime = 'nodejs';

/** Prose sections read better in teaching order than in file order. */
const KIND_ORDER = [
  'overview',
  'pronunciation',
  'culture',
  'notes',
  'takeaways',
] as const;

const KIND_LABEL: Record<string, string> = {
  overview: 'Overview',
  pronunciation: 'Pronunciation',
  culture: 'Culture',
  notes: 'Notes',
  takeaways: 'Takeaways',
};

export default async function LessonOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const [sections, counts] = await Promise.all([
    getLessonSections(lesson.id),
    getLessonCounts(lesson.id),
  ]);

  const ordered = [...sections].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind as (typeof KIND_ORDER)[number]) -
        KIND_ORDER.indexOf(b.kind as (typeof KIND_ORDER)[number]) ||
      a.orderIndex - b.orderIndex,
  );

  return (
    <div>
      <section aria-labelledby="contents" className="mb-8">
        <h2 id="contents" className="sr-only">
          What this lesson contains
        </h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ['Vocabulary', counts.vocabulary, 'vocabulary'],
              ['Grammar', counts.grammar, 'grammar'],
              ['Classwork', counts.classwork, 'classwork'],
              ['Homework', counts.homework, 'homework'],
              ['Quiz', counts.quiz, 'quiz'],
            ] as const
          ).map(([label, value, segment]) => (
            <Link
              key={label}
              href={`/lessons/${slug}/${segment}`}
              className="rounded-sm border border-rule bg-card p-3 transition-colors hover:border-accent"
            >
              <dt className="font-mono text-xs text-ink-muted">{label}</dt>
              <dd className="mt-0.5 font-display text-[length:var(--text-lg)] font-semibold">
                {value}
              </dd>
            </Link>
          ))}
        </dl>
      </section>

      {lesson.prerequisites.length > 0 ? (
        <section className="mb-8">
          <h2 className="font-display text-base font-semibold">Before this lesson</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {lesson.prerequisites.map((slugRef) => (
              <li key={slugRef}>
                <Link
                  href={`/lessons/${slugRef}`}
                  className="rounded-sm border border-rule px-2 py-1 font-mono text-xs text-accent hover:border-accent"
                >
                  {slugRef}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
       * Built from the lesson's own Aussprache tables, so it appears only for
       * lessons that actually teach sounds.
       */}
      {ordered
        .filter((section) => section.kind === 'pronunciation')
        .map((section) => (
          <PronunciationTrainer key={`trainer-${section.id}`} markdown={section.bodyMd} />
        ))}

      {ordered.length === 0 ? (
        <p className="text-ink-muted">This lesson has no prose sections.</p>
      ) : (
        ordered.map((section) => (
          <section key={section.id} className="mb-10">
            <h2 className="mb-1 font-display text-[length:var(--text-lg)] font-semibold">
              {section.title}
            </h2>
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-muted">
              {KIND_LABEL[section.kind] ?? section.kind}
            </p>
            {/*
             * Pronunciation tables get a speak button on every German example
             * word: hearing the word is the point of that table, and reading
             * it is exactly what does not work.
             */}
            <Markdown speakable={section.kind === 'pronunciation'}>
              {section.bodyMd}
            </Markdown>
          </section>
        ))
      )}
    </div>
  );
}
