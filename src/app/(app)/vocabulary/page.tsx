import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getVocabFacets, searchVocab } from '@/db/queries/banks';
import { Noun } from '@/components/german/Noun';
import { SpeakButton } from '@/components/german/SpeakButton';
import { maturityOf } from '@/lib/srs/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Vocabulary' };

const MATURITY_LABEL: Record<string, string> = {
  new: 'new',
  learning: 'learning',
  young: 'young',
  mature: 'mature',
  leech: 'leech',
};

/** Global word bank with search and filters — Section 10. */
export default async function VocabularyBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return typeof value === 'string' && value ? value : undefined;
  };

  const filters = {
    q: one('q'),
    gender: one('gender'),
    pos: one('pos'),
    tag: one('tag'),
    level: one('level'),
    lesson: one('lesson'),
    due: one('due'),
  };

  const [rows, facets] = await Promise.all([
    searchVocab(session.user.id, filters),
    getVocabFacets(),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Vocabulary
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Wortschatz</span> · {rows.length} words
        </p>
      </div>

      {/* A plain GET form: filters end up in the URL, so a search is shareable
          and survives a refresh without any client state. */}
      <form className="mb-6 flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs text-ink-muted">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="German or English"
            className="min-h-11 w-56 rounded-sm border border-rule bg-card px-3 py-2 font-serif focus:border-accent"
          />
        </label>

        <Select name="gender" label="Gender" value={filters.gender}>
          <option value="der">der</option>
          <option value="die">die</option>
          <option value="das">das</option>
        </Select>

        <Select name="pos" label="Type" value={filters.pos}>
          {['noun', 'verb', 'adj', 'adv', 'prep', 'numeral', 'phrase'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>

        <Select name="tag" label="Tag" value={filters.tag}>
          {facets.tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>

        <Select name="level" label="Level" value={filters.level}>
          {facets.levels.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </Select>

        <Select name="lesson" label="Lesson" value={filters.lesson}>
          {facets.lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {String(lesson.lessonNumber ?? '—').padStart(2, '0')}
            </option>
          ))}
        </Select>

        <Select name="due" label="State" value={filters.due}>
          <option value="due">due now</option>
          <option value="new">not started</option>
        </Select>

        <button
          type="submit"
          className="min-h-11 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
        >
          Apply
        </button>
        <Link
          href="/vocabulary"
          className="min-h-11 px-2 py-2 font-mono text-xs text-accent hover:underline"
        >
          clear
        </Link>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">Nothing matches</h2>
          <p className="mt-2 text-ink-muted">
            Try a shorter search, or clear the filters. Search understands German stems,
            so <span lang="de">Häuser</span> finds <span lang="de">Haus</span>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-rule">
          <table className="w-full border-collapse text-left">
            <thead className="bg-paper">
              <tr className="border-b border-rule">
                {['Word', 'Meaning', 'Type', 'Lesson', 'State', ''].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2 font-mono text-xs uppercase tracking-wider text-ink-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const maturity = maturityOf({
                  reps: row.reps ?? 0,
                  intervalDays: Number(row.intervalDays ?? 0),
                  lapses: row.lapses ?? 0,
                });
                return (
                  <tr key={row.id} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2">
                      {row.pos === 'noun' ? (
                        <Noun
                          de={row.de}
                          article={row.article as 'der' | 'die' | 'das'}
                          plural={row.plural}
                        />
                      ) : (
                        <span lang="de" className="font-serif font-medium">
                          {row.de}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-serif text-ink-muted">{row.en}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                      {row.pos}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/lessons/${row.lessonId}/vocabulary`}
                        className="text-accent hover:underline"
                      >
                        {String(row.lessonNumber ?? '—').padStart(2, '0')}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                      {MATURITY_LABEL[maturity]}
                    </td>
                    <td className="px-3 py-2">
                      <SpeakButton
                        text={
                          row.pos === 'noun' && row.article !== 'none'
                            ? `${row.article} ${row.de}`
                            : row.de
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Select({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs text-ink-muted">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className="min-h-11 rounded-sm border border-rule bg-card px-2 py-2 font-serif focus:border-accent"
      >
        <option value="">any</option>
        {children}
      </select>
    </label>
  );
}
