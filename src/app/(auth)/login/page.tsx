import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // currentUser, not auth(): a suspended account's token must not bounce here forever.
  if (await currentUser()) redirect('/');

  const { callbackUrl } = await searchParams;

  return (
    <>
      <h1 className="text-[length:var(--text-xl)] font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        New here?{' '}
        <Link href="/signup" className="text-accent underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <div className="mt-6 rounded-sm border border-rule bg-card p-6">
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </>
  );
}
