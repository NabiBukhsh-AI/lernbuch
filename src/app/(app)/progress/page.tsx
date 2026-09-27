import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getMistakes,
  getSkillStats,
  getStreak,
  getVocabMaturity,
  getWeakSkills,
  WEAK_MIN_ATTEMPTS,
} from '@/db/queries/progress';
import { skillFamily } from '@/config/skills';
import { cn } from '@/lib/utils';
import { Stat } from '@/components/ui/stat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Progress' };

const STATUS_STYLE: Record<string, string> = {
  mastered: 'border-ok/50 bg-ok/10',
  weak: 'border-warn/50 bg-warn-soft',
  learning: 'border-rule bg-card',
};

/** Analytics — Section 15. Copy is factual and never shaming. */
export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [skills, weak, mistakeRows, maturity, streak] = await Promise.all([
    getSkillStats(userId),
    getWeakSkills(userId),
    getMistakes(userId, { resolved: false }),
    getVocabMaturity(userId),
    getStreak(userId),
  ]);

  const families = new Map<string, typeof skills>();
  for (const skill of skills) {
    const key = skillFamily(skill.skillTag);
    families.set(key, [...(families.get(key) ?? []), skill]);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Progress
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          <span lang="de">Fortschritt</span>
        </p>
      </div>

      {/* ---- streak and time ------------------------------------------- */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Day streak"
          value={String(streak.current)}
          note={
            streak.current === 0
              ? 'Start one whenever you like'
              : streak.current === 1
                ? 'day in a row'
                : 'days in a row'
          }
        />
        <Stat label="This week" value={`${streak.weekMinutes}`} note="minutes studied" />
        <Stat
          label="Vocabulary"
          value={`${maturity.mature + maturity.young}`}
          note={`of ${maturity.total} known well`}
        />
      </section>

      {/* ---- weak skills ------------------------------------------------ */}
      <section>
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Worth practising
        </h2>
        {weak.length === 0 ? (
          <p className="mt-2 max-w-[68ch] text-ink-muted">
            Nothing is flagged yet. A skill shows up here once you have answered it at
            least {WEAK_MIN_ATTEMPTS} times and are getting it right under 70% of the
            time.
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-wrap gap-2">
              {weak.map((skill) => (
                <li
                  key={skill.skillTag}
                  className="rounded-sm border border-warn/50 bg-warn-soft px-2 py-1 font-mono text-xs"
                >
                  {skill.skillTag}
                  <span className="ml-2 text-ink-muted">
                    {Math.round(skill.rollingScore)}%
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={`/drill?tags=${encodeURIComponent(weak.map((s) => s.skillTag).join(','))}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:opacity-90"
            >
              Drill these
            </Link>
          </>
        )}
      </section>

      {/* ---- mastery grid ----------------------------------------------- */}
      <section>
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Mastery
        </h2>
        {skills.length === 0 ? (
          <p className="mt-2 max-w-[68ch] text-ink-muted">
            Nothing here yet. Skills appear as you answer exercises — each one is tagged,
            and the tags build up this grid.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {[...families.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([family, list]) => (
                <div key={family}>
                  <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    {family}
                  </h3>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {list.map((skill) => (
                      <li
                        key={skill.skillTag}
                        title={`${skill.correct} of ${skill.attempts} correct`}
                        className={cn(
                          'rounded-sm border px-2 py-1 font-mono text-xs',
                          STATUS_STYLE[skill.status],
                        )}
                      >
                        {skill.skillTag.split('.').slice(1).join('.') || skill.skillTag}
                        <span className="ml-2 text-ink-muted">
                          {Math.round(skill.rollingScore)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* ---- vocabulary maturity ---------------------------------------- */}
      <section>
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Vocabulary
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(['new', 'learning', 'young', 'mature', 'leech'] as const).map((bucket) => (
            <div key={bucket} className="rounded-sm border border-rule bg-card p-3">
              <dt className="font-mono text-xs text-ink-muted">{bucket}</dt>
              <dd className="mt-0.5 font-display text-[length:var(--text-lg)] font-semibold">
                {maturity[bucket]}
              </dd>
            </div>
          ))}
        </dl>
        {maturity.leech > 0 ? (
          <p className="mt-2 max-w-[68ch] font-serif text-sm text-ink-muted">
            A leech is a word you have forgotten six times or more. That usually means the
            hint needs rewriting rather than more repetition.
          </p>
        ) : null}
      </section>

      {/* ---- mistake log ------------------------------------------------ */}
      <section>
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Open mistakes
        </h2>
        {mistakeRows.length === 0 ? (
          <p className="mt-2 text-ink-muted">Nothing outstanding.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mistakeRows.slice(0, 30).map((mistake) => (
              <li key={mistake.id} className="rounded-sm border border-rule bg-card p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span lang="de" className="font-serif line-through decoration-warn">
                    {mistake.got}
                  </span>
                  <span aria-hidden className="text-ink-muted">
                    →
                  </span>
                  <span lang="de" className="font-serif font-semibold">
                    {mistake.expected}
                  </span>
                  {mistake.origin === 'class' ? (
                    <span className="rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted">
                      from class
                    </span>
                  ) : null}
                </div>
                {mistake.noteMd ? (
                  <p className="mt-1 font-serif text-sm text-ink-muted">
                    {mistake.noteMd.replace(/\s*\[streak:\d+\]/, '')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
