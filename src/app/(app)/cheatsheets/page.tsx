import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { grammarPoints, lessons } from '@/db/schema';
import { DecisionTree } from '@/components/german/DecisionTree';
import { CaseTable, type GrammarTable } from '@/components/german/CaseTable';
import { Markdown } from '@/components/german/Markdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Cheatsheets' };

/**
 * The two decision trees, given a permanent home.
 *
 * Lektion 02's instruction block asks for these to live at a top-level link
 * rather than being buried inside one lesson, because they are the pages the
 * learner returns to most. The prose and tables still come from the lesson, so
 * there is one source of truth; only the route is different.
 */
const SHEETS = [
  {
    id: 'artikel-entscheidungsbaum',
    kind: 'article' as const,
    heading: 'Which article?',
    blurb:
      'Three questions in a fixed order: gender, then role in the sentence, then definite or indefinite. Answering them out of order is what makes this feel impossible.',
  },
  {
    id: 'nicht-oder-kein-entscheidungsbaum',
    kind: 'negation' as const,
    heading: 'nicht or kein?',
    blurb:
      'Decided entirely by what stands in front of the noun — never by the meaning and never by the gender.',
  },
];

export default async function CheatsheetsPage() {
  const rows = await db
    .select({
      id: grammarPoints.id,
      title: grammarPoints.title,
      ruleMd: grammarPoints.ruleMd,
      tables: grammarPoints.tables,
      memoryHook: grammarPoints.memoryHook,
      lessonId: grammarPoints.lessonId,
      lessonNumber: lessons.lessonNumber,
    })
    .from(grammarPoints)
    .leftJoin(lessons, eq(lessons.id, grammarPoints.lessonId))
    .where(
      inArray(
        grammarPoints.id,
        // Composed ids end with the authored id, so match on the suffix.
        SHEETS.map((sheet) => `2026-08-16-lektion-02:grammar:${sheet.id}`),
      ),
    );

  const byAuthoredId = new Map(rows.map((row) => [row.id.split(':').pop()!, row]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Cheatsheets
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          The two decisions behind most A1 mistakes
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">Not available yet</h2>
          <p className="mt-2 text-ink-muted">
            These come from Lektion 02 and appear here once that lesson is published.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {SHEETS.map((sheet) => {
            const point = byAuthoredId.get(sheet.id);
            if (!point) return null;
            const tables = (point.tables ?? []) as GrammarTable[];

            return (
              <section key={sheet.id} id={sheet.id}>
                <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
                  {sheet.heading}
                </h2>
                <p className="mt-1 max-w-[68ch] font-serif text-ink-muted">
                  {sheet.blurb}
                </p>

                <div className="mt-4">
                  <DecisionTree kind={sheet.kind} />
                </div>

                {point.memoryHook ? (
                  <p className="mt-4 rounded-sm border border-accent bg-accent-soft px-4 py-3 font-serif">
                    <span className="font-mono text-xs uppercase tracking-wider text-accent">
                      Remember
                    </span>{' '}
                    {point.memoryHook}
                  </p>
                ) : null}

                {tables.map((table, index) => (
                  <CaseTable key={index} table={table} />
                ))}

                <details className="mt-4">
                  <summary className="cursor-pointer font-mono text-xs text-accent hover:underline">
                    the full rule
                  </summary>
                  <Markdown className="mt-2">{point.ruleMd}</Markdown>
                </details>

                <p className="mt-3 font-mono text-xs text-ink-muted">
                  From{' '}
                  <Link
                    href={`/lessons/${point.lessonId}/grammar#${sheet.id}`}
                    className="text-accent hover:underline"
                  >
                    Lektion {String(point.lessonNumber ?? '—').padStart(2, '0')}
                  </Link>
                </p>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
