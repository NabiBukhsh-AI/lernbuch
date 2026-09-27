import Link from 'next/link';
import { Search } from 'lucide-react';
import { getAdminStats, listUsers, USERS_PAGE_SIZE } from '@/db/queries/admin';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stat } from '@/components/ui/stat';
import { cn, timeAgo } from '@/lib/utils';
import { UserActions } from './user-actions';

export const metadata = { title: 'Admin' };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [stats, { rows, total }] = await Promise.all([
    getAdminStats(),
    listUsers({ q, page }),
  ]);
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  const pageHref = (n: number) =>
    `/admin?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Accounts"
          value={String(stats.users)}
          note={`${stats.newThisWeek} new this week`}
        />
        <Stat
          label="Active"
          value={String(stats.activeThisWeek)}
          note={`in the last 7 days${stats.suspended ? ` · ${stats.suspended} suspended` : ''}`}
        />
        <Stat
          label="Answers"
          value={String(stats.answersThisWeek)}
          note="submitted this week"
        />
        <Stat
          label="Lessons"
          value={String(stats.published)}
          note={`published, of ${stats.lessons}`}
          href="/admin/lessons"
        />
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[length:var(--text-lg)] font-semibold">Learners</h2>
            <p className="font-serif text-sm text-ink-muted">
              {total} {total === 1 ? 'account' : 'accounts'}
              {q ? ` matching “${q}”` : ''}, most recently active first
            </p>
          </div>

          <form className="flex w-full max-w-xs items-center gap-2" role="search">
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name or username"
              aria-label="Search learners"
              className="font-serif"
            />
            <button
              type="submit"
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
              aria-label="Search"
            >
              <Search aria-hidden className="size-4" />
            </button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-card">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-paper">
              <tr className="border-b border-rule">
                {[
                  'Learner',
                  'Joined',
                  'Last active',
                  'Answers',
                  'Accuracy',
                  'Quizzes',
                  'Cards',
                  '',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2 font-mono text-xs font-normal uppercase tracking-wider text-ink-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-rule last:border-0',
                    row.disabledAt && 'opacity-60',
                  )}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.displayName}</span>
                      {row.role === 'admin' ? (
                        <span className="rounded-sm bg-accent-soft px-1.5 font-mono text-xs text-accent">
                          admin
                        </span>
                      ) : null}
                      {row.disabledAt ? (
                        <span className="rounded-sm bg-warn-soft px-1.5 font-mono text-xs text-warn">
                          suspended
                        </span>
                      ) : null}
                    </div>
                    <span className="font-mono text-xs text-ink-muted">
                      @{row.username} · {row.targetLevel}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">
                    {row.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td
                    className="px-3 py-2.5 font-mono text-xs"
                    title={row.lastActive?.toISOString()}
                  >
                    {timeAgo(row.lastActive)}
                  </td>
                  <td className="px-3 py-2.5 font-mono">{row.answers}</td>
                  <td className="px-3 py-2.5 font-mono">
                    {row.accuracy === null ? '—' : `${row.accuracy}%`}
                  </td>
                  <td className="px-3 py-2.5 font-mono">{row.quizzes}</td>
                  <td className="px-3 py-2.5 font-mono">{row.cards}</td>
                  <td className="px-3 py-2.5">
                    {row.role === 'learner' ? (
                      <UserActions
                        userId={row.id}
                        username={row.username}
                        suspended={Boolean(row.disabledAt)}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center font-serif text-ink-muted"
                  >
                    {q ? 'Nobody matches that search.' : 'No accounts yet.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {pages > 1 ? (
          <nav
            aria-label="Pages"
            className="mt-4 flex items-center justify-between font-mono text-xs"
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="text-accent hover:underline">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-muted">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className="text-accent hover:underline">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
