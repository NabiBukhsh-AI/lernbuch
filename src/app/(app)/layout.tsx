import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { Rail } from '@/components/shell/Rail';
import { Header } from '@/components/shell/Header';
import { UmlautBar } from '@/components/shell/UmlautBar';
import { GenderLegend } from '@/components/german/GenderLegend';

/** Argon2 and Neon both need the Node runtime. */
export const runtime = 'nodejs';

/**
 * App shell.
 *
 *   rail | header
 *        | content, single column, 68ch measure
 *   ------------------------------------------
 *   umlaut bar | gender legend
 *
 * The middleware already blocks requests without a session. This check is the
 * second line of defence, and the one that turns away a suspended or deleted
 * account whose token is still valid.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          displayName={user.displayName}
          targetLevel={user.targetLevel ?? 'A1.1'}
          isAdmin={user.role === 'admin'}
        />

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>

        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-paper/95 px-4 py-2 backdrop-blur md:px-6">
          <UmlautBar />
          <GenderLegend />
        </footer>
      </div>
    </div>
  );
}
