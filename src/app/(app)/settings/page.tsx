import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { updateSettings } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { ChangePasswordForm, DeleteAccountForm } from './account-forms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Settings' };

/** Preferences and the account itself. */
export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-[length:var(--text-xl)] font-semibold">
          Settings
        </h1>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          @{user.username} · {user.role === 'admin' ? 'admin' : 'learner'} · joined{' '}
          {user.createdAt.toISOString().slice(0, 10)}
        </p>
      </div>

      <form action={updateSettings} className="max-w-[68ch] space-y-5">
        <fieldset className="space-y-4">
          <legend className="font-display text-[length:var(--text-lg)] font-semibold">
            Profile
          </legend>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Display name</span>
            <input
              name="displayName"
              defaultValue={user.displayName}
              required
              maxLength={40}
              autoComplete="name"
              className="min-h-11 w-full max-w-sm rounded-sm border border-rule bg-card px-3 py-2 font-serif focus:border-accent"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-[length:var(--text-lg)] font-semibold">
            How you are graded
          </legend>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="strictMode"
              defaultChecked={user.strictMode}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">Strict mode</span>
              <span className="block font-serif text-sm text-ink-muted">
                Off, writing <span lang="de">Strasse</span> for{' '}
                <span lang="de">Straße</span> is accepted with a note, and a missing
                capital is &ldquo;almost&rdquo;. On, both cost you the mark — which is how
                an exam will treat them.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="showUrdu"
              defaultChecked={user.showUrdu}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">Show Urdu translations</span>
              <span className="block font-serif text-sm text-ink-muted">
                Displays the Urdu gloss alongside the English one where a lesson provides
                it.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-display text-[length:var(--text-lg)] font-semibold">
            Review
          </legend>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Cards per day</span>
            <input
              type="number"
              name="dailyGoal"
              min={5}
              max={200}
              defaultValue={user.dailyGoal}
              className="min-h-11 w-32 rounded-sm border border-rule bg-card px-3 py-2 font-mono focus:border-accent"
            />
            <span className="font-serif text-sm text-ink-muted">
              How many due cards a review session will offer at most.
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Target level</span>
            <select
              name="targetLevel"
              defaultValue={user.targetLevel ?? 'A1.1'}
              className="min-h-11 w-32 rounded-sm border border-rule bg-card px-2 py-2 font-serif focus:border-accent"
            >
              {['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2'].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <Button type="submit">Save settings</Button>
      </form>

      <section className="max-w-[68ch]">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          Password
        </h2>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </section>

      {user.role === 'learner' ? (
        <section className="max-w-[68ch] rounded-sm border border-warn/40 p-5">
          <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
            Delete account
          </h2>
          <p className="mt-1 mb-4 font-serif text-sm text-ink-muted">
            Removes your account and all of your progress, reviews and mistakes. This
            cannot be undone.
          </p>
          <DeleteAccountForm username={user.username} />
        </section>
      ) : null}
    </div>
  );
}
