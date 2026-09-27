import { notFound } from 'next/navigation';
import { getGrammar, getLesson, getRelatedGrammar } from '@/db/queries/lessons';
import { RelatedStrip } from '@/components/german/RelatedStrip';
import { Markdown } from '@/components/german/Markdown';
import { CaseTable, type GrammarTable } from '@/components/german/CaseTable';
import { CaseChips, type CaseSegment } from '@/components/german/CaseChips';
import { Satzklammer } from '@/components/german/Satzklammer';
import { TekamoloBar, type TekamoloSegment } from '@/components/german/TekamoloBar';
import { WrongRight } from '@/components/german/WrongRight';
import { SpeakButton } from '@/components/german/SpeakButton';

export const runtime = 'nodejs';

/** Shapes of the jsonb columns, as written by the Section 8.5 schema. */
type Example = {
  de: string;
  en?: string | null;
  note?: string | null;
  cases?: CaseSegment[] | null;
  satzklammer?: { position2: string; ende: string } | null;
  tekamolo?: TekamoloSegment[] | null;
};

type CommonMistake = { wrong: string; right: string; why: string };

/**
 * Rules for one lesson — Section 10.
 *
 * Each point renders in teaching order: the rule, the pattern, the table with
 * its highlighted cell, the examples with their case chips and Satzklammer,
 * the contrast against what was learned before, then the mistakes and tips.
 */
export default async function LessonGrammarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const points = await getGrammar(lesson.id);
  const related = await getRelatedGrammar(points, lesson.classDate);

  if (points.length === 0) {
    return <p className="text-ink-muted">This lesson has no grammar block.</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Grammar
        </h2>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Grammatik</span> · {points.length} rules
        </p>
      </div>

      <div className="space-y-10">
        {points.map((point) => {
          const tables = (point.tables ?? []) as GrammarTable[];
          const examples = (point.examples ?? []) as Example[];
          const mistakes = (point.commonMistakes ?? []) as CommonMistake[];

          return (
            <article
              key={point.id}
              id={point.id.split(':').pop()}
              className="border-t border-rule pt-6 first:border-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-display text-[length:var(--text-lg)] font-semibold">
                  <span lang="de">{point.title}</span>
                </h3>
                {point.cefr ? (
                  <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">
                    {point.cefr}
                  </span>
                ) : null}
              </div>

              {point.skillTags.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {point.skillTags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4">
                <Markdown>{point.ruleMd}</Markdown>
              </div>

              {point.patternMd ? (
                <pre className="mt-4 overflow-x-auto rounded-sm border border-rule bg-card p-3 font-mono text-sm">
                  <code lang="de">{point.patternMd.trim()}</code>
                </pre>
              ) : null}

              {tables.map((table, index) => (
                <CaseTable key={index} table={table} />
              ))}

              {examples.length > 0 ? (
                <section className="mt-5">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Examples
                  </h4>
                  <ul className="mt-2 space-y-4">
                    {examples.map((example, index) => (
                      <li
                        key={index}
                        className="rounded-sm border border-rule bg-card p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {/* Rule 3.4: the bracket wherever the data carries it. */}
                            {example.satzklammer ? (
                              <Satzklammer
                                sentence={example.de}
                                position2={example.satzklammer.position2}
                                ende={example.satzklammer.ende}
                              />
                            ) : example.cases && example.cases.length > 0 ? (
                              <CaseChips sentence={example.de} segments={example.cases} />
                            ) : (
                              <p
                                lang="de"
                                className="font-serif text-[length:var(--text-prose)]"
                              >
                                {example.de}
                              </p>
                            )}
                          </div>
                          <SpeakButton text={example.de} />
                        </div>

                        {example.en ? (
                          <p className="mt-1 text-sm text-ink-muted">{example.en}</p>
                        ) : null}

                        {example.tekamolo && example.tekamolo.length > 0 ? (
                          <TekamoloBar segments={example.tekamolo} />
                        ) : null}

                        {example.note ? (
                          <p className="mt-2 border-l-2 border-rule pl-3 font-serif text-sm text-ink-muted">
                            {example.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {point.contrastMd ? (
                <section className="mt-5 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-4 py-3">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-accent">
                    Compared with what you already know
                  </h4>
                  <Markdown className="mt-1">{point.contrastMd}</Markdown>
                </section>
              ) : null}

              {mistakes.length > 0 ? (
                <section className="mt-5">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Common mistakes
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {mistakes.map((mistake, index) => (
                      <li key={index}>
                        <WrongRight
                          wrong={mistake.wrong}
                          right={mistake.right}
                          why={mistake.why}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {point.tips.length > 0 ? (
                <section className="mt-5">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Tips
                  </h4>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 font-serif marker:text-accent">
                    {point.tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {point.memoryHook ? (
                <p className="mt-5 rounded-sm border border-accent bg-accent-soft px-4 py-3 font-serif">
                  <span className="font-mono text-xs uppercase tracking-wider text-accent">
                    Remember
                  </span>{' '}
                  {point.memoryHook}
                </p>
              ) : null}

              <RelatedStrip related={related.get(point.id) ?? []} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
