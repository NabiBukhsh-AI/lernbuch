import Link from 'next/link';
import { listGrammar } from '@/db/queries/banks';
import { skillFamily } from '@/config/skills';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Grammar' };

/**
 * Global rule index — Section 10.
 *
 * Grouped by skill-tag family rather than by lesson, because the point of the
 * global index is to show the progression of a topic across lessons: every
 * Akkusativ rule together, in the order they were taught.
 */
export default async function GrammarBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : undefined;

  const points = await listGrammar(q);

  const families = new Map<string, typeof points>();
  for (const point of points) {
    // A rule with several tags appears under each family it belongs to.
    const keys = point.skillTags.length
      ? [...new Set(point.skillTags.map(skillFamily))]
      : ['ungrouped'];
    for (const key of keys) {
      const list = families.get(key) ?? [];
      list.push(point);
      families.set(key, list);
    }
  }

  const sorted = [...families.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Grammar
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Grammatik</span> · {points.length} rules across {sorted.length}{' '}
          topics
        </p>
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-xs text-ink-muted">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="rule, title or skill tag"
            className="min-h-11 w-64 rounded-sm border border-rule bg-card px-3 py-2 font-serif focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
        >
          Search
        </button>
        <Link
          href="/grammar"
          className="min-h-11 px-2 py-2 font-mono text-xs text-accent hover:underline"
        >
          clear
        </Link>
      </form>

      {points.length === 0 ? (
        <div className="rounded-sm border border-rule bg-card p-5">
          <h2 className="text-base font-semibold">Nothing matches</h2>
          <p className="mt-2 text-ink-muted">
            Try a shorter search, or clear it to see every rule.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sorted.map(([family, list]) => (
            <section key={family}>
              {/*
               * The count sits outside the heading on purpose: inside, it
               * becomes part of the accessible name ("case 5"), which is not
               * what the section is called.
               */}
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-base font-semibold">{family}</h2>
                <span className="font-mono text-xs text-ink-muted">
                  {list.length} {list.length === 1 ? 'rule' : 'rules'}
                </span>
              </div>

              <ul className="mt-2 space-y-2">
                {list.map((point) => (
                  <li
                    key={`${family}:${point.id}`}
                    className="rounded-sm border border-rule bg-card p-3"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link
                        href={`/lessons/${point.lessonId}/grammar#${point.id.split(':').pop()}`}
                        className="font-display font-semibold text-accent hover:underline"
                      >
                        <span lang="de">{point.title}</span>
                      </Link>
                      {point.cefr ? (
                        <span className="font-mono text-xs text-ink-muted">
                          {point.cefr}
                        </span>
                      ) : null}
                      <span className="font-mono text-xs text-ink-muted">
                        Lektion {String(point.lessonNumber ?? '—').padStart(2, '0')}
                      </span>
                    </div>

                    {point.memoryHook ? (
                      <p className="mt-1 font-serif text-sm">{point.memoryHook}</p>
                    ) : (
                      <p className="mt-1 line-clamp-2 font-serif text-sm text-ink-muted">
                        {point.ruleMd.split('\n')[0]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
