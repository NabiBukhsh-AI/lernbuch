import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { AdminNav } from './admin-nav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only. A learner gets a plain 404 rather than "forbidden", so the page
 * does not advertise that it exists. Every admin action re-checks the role.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user?.role !== 'admin') notFound();

  return (
    <div>
      <h1 className="text-[length:var(--text-xl)] font-semibold">Admin</h1>
      <div className="mt-3">
        <AdminNav />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
