import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { SignupForm } from './signup-form';

export const metadata = { title: 'Create an account' };

export default async function SignupPage() {
  if (await currentUser()) redirect('/');

  return (
    <>
      <h1 className="text-[length:var(--text-xl)] font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Already have one?{' '}
        <Link href="/login" className="text-accent underline underline-offset-4">
          Sign in
        </Link>
      </p>

      <div className="mt-6 rounded-sm border border-rule bg-card p-6">
        <SignupForm />
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        No email needed. Keep your password somewhere safe: there is no self-service
        reset, though the site admin can reset it for you.
      </p>
    </>
  );
}
