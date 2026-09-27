import { notFound } from 'next/navigation';
import { getLesson, getVocab } from '@/db/queries/lessons';
import { Noun } from '@/components/german/Noun';
import { Verb } from '@/components/german/Verb';
import { SpeakButton } from '@/components/german/SpeakButton';
import type { VerbForms } from '@/components/german/ConjugationTable';

export const runtime = 'nodejs';

const POS_LABEL: Record<string, string> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  prep: 'preposition',
  conj: 'conjunction',
  pronoun: 'pronoun',
  numeral: 'numeral',
  phrase: 'phrase',
  particle: 'particle',
};

/**
 * Word list for one lesson — Section 10.
 *
 * Rules 3.1 and 3.2 are enforced at the component level: a noun always renders
 * through <Noun> so it can never appear without its article and plural, and a
 * verb always renders through <Verb>.
 */
export default async function LessonVocabularyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const items = await getVocab(lesson.id);

  if (items.length === 0) {
    return <p className="text-ink-muted">This lesson has no vocabulary block.</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Vocabulary
        </h2>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Wortschatz</span> · {items.length} words
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const forms = item.verbForms as VerbForms | null;
          const spoken =
            item.pos === 'noun' && item.article !== 'none'
              ? `${item.article} ${item.de}`
              : item.de;

          return (
            <li
              key={item.id}
              className="rounded-sm border border-rule bg-card p-4"
              id={item.id.split(':').pop()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[length:var(--text-prose)]">
                    {item.pos === 'noun' ? (
                      <Noun de={item.de} article={item.article} plural={item.plural} />
                    ) : item.pos === 'verb' && forms?.praesens ? (
                      <Verb infinitive={item.de} forms={forms} />
                    ) : (
                      <span lang="de" className="font-serif font-medium">
                        {item.de}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-ink-muted">{item.en}</p>

                  {item.ur ? (
                    <p lang="ur" dir="rtl" className="mt-0.5 text-ink-muted">
                      {item.ur}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted">
                    {POS_LABEL[item.pos] ?? item.pos}
                  </span>
                  <SpeakButton text={spoken} />
                </div>
              </div>

              {item.ipa ? (
                <p className="mt-2 font-mono text-xs text-ink-muted">{item.ipa}</p>
              ) : null}

              {item.exampleDe ? (
                <div className="mt-3 border-l-2 border-rule pl-3">
                  <p lang="de" className="font-serif">
                    {item.exampleDe}
                  </p>
                  {item.exampleEn ? (
                    <p className="text-sm text-ink-muted">{item.exampleEn}</p>
                  ) : null}
                </div>
              ) : null}

              {item.genderTip ? (
                <p className="mt-3 rounded-sm bg-accent-soft/40 px-3 py-2 font-serif text-sm">
                  <span className="font-mono text-xs uppercase tracking-wider text-accent">
                    Gender
                  </span>{' '}
                  {item.genderTip}
                </p>
              ) : null}

              {item.usageTip ? (
                <p className="mt-2 rounded-sm bg-accent-soft/40 px-3 py-2 font-serif text-sm">
                  <span className="font-mono text-xs uppercase tracking-wider text-accent">
                    Usage
                  </span>{' '}
                  {item.usageTip}
                </p>
              ) : null}

              {item.falseFriend ? (
                <p className="mt-2 rounded-sm border-l-2 border-warn bg-warn-soft px-3 py-2 font-serif text-sm">
                  <span className="font-mono text-xs uppercase tracking-wider text-warn">
                    False friend
                  </span>{' '}
                  {item.falseFriend}
                </p>
              ) : null}

              {item.collocations.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {item.collocations.map((phrase) => (
                    <li
                      key={phrase}
                      lang="de"
                      className="rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem]"
                    >
                      {phrase}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
