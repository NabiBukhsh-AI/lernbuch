import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Brain, Lightbulb, ListChecks, Repeat } from 'lucide-react';
import { CaseChips } from '@/components/german/CaseChips';
import { Noun } from '@/components/german/Noun';
import { Satzklammer } from '@/components/german/Satzklammer';
import { WrongRight } from '@/components/german/WrongRight';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { buttonVariants } from '@/components/ui/button';
import { getContentTotals } from '@/db/queries/lessons';
import { currentUser } from '@/lib/session';
import { APP_NAME, cn } from '@/lib/utils';
import { GenderDemo } from './gender-demo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} · Learn German lesson by lesson` },
  description:
    'Free German lessons from A1 to B1 with colour-coded genders, visible cases, exercises that explain every answer, and spaced repetition.',
  robots: { index: true, follow: true },
};

const STEPS = ['Lesson', 'Vocabulary', 'Grammar', 'Classwork', 'Homework', 'Quiz'];

const FEATURES = [
  {
    icon: Lightbulb,
    title: 'Every exercise answers “why”',
    body: 'The solution never arrives alone: it comes with the reason and a rule you can take to the next sentence.',
  },
  {
    icon: ListChecks,
    title: 'Homework with staged hints',
    body: 'A nudge, then the rule, then the answer, and only when you ask. Hints are recorded but never cost marks.',
  },
  {
    icon: Repeat,
    title: 'Spaced repetition',
    body: 'Every word and every rule you get wrong comes back just before you would have forgotten it.',
  },
  {
    icon: Brain,
    title: 'Weak skills, named',
    body: 'Progress is tracked per grammar skill, so “Akkusativ endings” becomes a drill, not a vague feeling.',
  },
];

/** The public face of the app. Everything past it needs an account. */
export default async function WelcomePage() {
  const [user, totals] = await Promise.all([currentUser(), getContentTotals()]);
  const primaryHref = user ? '/' : '/signup';

  // Real numbers from the database, not testimonials: there are none to verify yet.
  const proof = [
    { value: totals.lessons, label: totals.lessons === 1 ? 'lesson' : 'lessons' },
    { value: totals.words, label: 'words with article and plural' },
    { value: totals.rules, label: 'grammar rules' },
    { value: totals.exercises, label: 'exercises, each with its why' },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link
            href="/welcome"
            className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted hover:text-ink"
          >
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account">
            <ThemeToggle />
            {user ? (
              <Link href="/" className={buttonVariants({ size: 'sm' })}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Sign in
                </Link>
                <Link href="/signup" className={buttonVariants({ size: 'sm' })}>
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ---- hero: the promise on the left, the proof you can try on the right ---- */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 md:px-8 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              German, A1 → B1
            </p>
            <h1 className="mt-3 text-[length:var(--text-2xl)] leading-[1.05] font-semibold text-balance md:text-[length:var(--text-3xl)]">
              German that shows you how it works.
            </h1>
            <p className="mt-5 max-w-[52ch] font-serif text-[length:var(--text-prose)] leading-relaxed text-ink-muted">
              Each lesson is a complete study unit: every noun with its gender, grammar
              with its structure made visible, exercises that explain themselves, and a
              review queue that remembers what you got wrong.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryHref} className={buttonVariants()}>
                {user ? 'Continue learning' : 'Start learning, free'}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              {user ? null : (
                <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
                  I have an account
                </Link>
              )}
            </div>
            <p className="mt-5 font-mono text-xs text-ink-muted">
              Free · no email needed · works on your phone
            </p>
          </div>

          <section
            aria-labelledby="try-heading"
            className="rounded-sm border border-rule bg-card p-6 shadow-[0_1px_0_var(--rule),0_16px_40px_-20px_rgb(0_0_0/0.3)] md:p-8"
          >
            <h2
              id="try-heading"
              className="font-mono text-xs uppercase tracking-wider text-accent"
            >
              Try one now, no account needed
            </h2>
            <div className="mt-4">
              <GenderDemo signedIn={Boolean(user)} />
            </div>
          </section>
        </section>

        {totals.lessons > 0 ? (
          <section aria-label="What is inside" className="border-y border-rule bg-card">
            <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-rule lg:grid-cols-4">
              {proof.map((item) => (
                <div key={item.label} className="flex flex-col bg-card px-4 py-6 md:px-8">
                  <dt className="order-2 mt-1 font-serif text-sm text-ink-muted">
                    {item.label}
                  </dt>
                  <dd className="font-display text-[length:var(--text-xl)] font-semibold tabular-nums">
                    {item.value.toLocaleString('en')}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* ---- the teaching devices, rendered by the same components the lessons use ---- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <h2 className="text-[length:var(--text-xl)] font-semibold">
            What makes it stick
          </h2>
          <p className="mt-1 max-w-[60ch] font-serif text-ink-muted">
            Four habits run through every lesson. These are live examples, not
            screenshots.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Panel
              title="Never a bare noun"
              note="Article, noun and plural always travel together, coloured by gender."
            >
              <div
                className="flex flex-col items-start gap-2 font-serif text-[length:var(--text-prose)]"
                lang="de"
              >
                <Noun de="Tisch" article="der" plural="Tische" />
                <Noun de="Lampe" article="die" plural="Lampen" />
                <Noun de="Buch" article="das" plural="Bücher" />
              </div>
            </Panel>

            <Panel
              title="Case you can see"
              note="Nominativ, Akkusativ and Dativ are marked under the words they change."
            >
              <div className="font-serif text-[length:var(--text-prose)]" lang="de">
                <CaseChips
                  sentence="Ich gebe dem Kind den Ball."
                  segments={[
                    { text: 'Ich', case: 'NOM' },
                    { text: 'dem Kind', case: 'DAT' },
                    { text: 'den Ball', case: 'AKK' },
                  ]}
                />
              </div>
            </Panel>

            <Panel
              title="The Satzklammer"
              note="The conjugated verb holds position two and the rest waits at the end. Every example shows the bracket."
            >
              <div className="font-serif text-[length:var(--text-prose)]" lang="de">
                <Satzklammer
                  sentence="Ich will morgen nach Berlin fahren."
                  position2="will"
                  ende="fahren"
                />
              </div>
            </Panel>

            <Panel
              title="Mistakes, turned around"
              note="The right form is the one that stands out, so the wrong one is not what you remember."
            >
              <div lang="de">
                <WrongRight
                  wrong="Ich habe gestern gegangen."
                  right="Ich bin gestern gegangen."
                  why="Verbs of movement take sein in the Perfekt."
                />
              </div>
            </Panel>
          </div>
        </section>

        <section className="border-t border-rule bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
            <h2 className="text-[length:var(--text-xl)] font-semibold">
              One loop per lesson
            </h2>
            <ol className="mt-6 flex flex-wrap items-center gap-2 font-mono text-sm">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="rounded-sm border border-rule bg-paper px-3 py-1.5">
                    <span className="mr-1.5 text-ink-muted">{index + 1}</span>
                    {step}
                  </span>
                  {index < STEPS.length - 1 ? (
                    <ArrowRight aria-hidden className="size-4 text-ink-muted" />
                  ) : null}
                </li>
              ))}
            </ol>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-sm border border-rule bg-paper p-5">
                  <Icon aria-hidden className="size-5 text-accent" />
                  <h3 className="mt-3 text-base font-semibold">{title}</h3>
                  <p className="mt-1.5 font-serif text-ink-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-sm bg-rail p-8 text-rail-ink md:flex-row md:items-center md:p-10">
            <div>
              <p className="text-[length:var(--text-lg)] font-semibold text-balance">
                Open it four weeks after a lesson and still know it.
              </p>
              <p className="mt-1 font-serif opacity-75">
                Free, and your progress is saved from the first answer.
              </p>
            </div>
            <Link
              href={primaryHref}
              className={cn(buttonVariants(), 'shrink-0 bg-rail-ink text-rail')}
            >
              {user ? 'Continue learning' : 'Create your free account'}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-xs text-ink-muted md:px-8">
          <span>{APP_NAME}</span>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-ink">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-sm border border-rule bg-card p-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-4 flex-1">{children}</div>
      <p className="mt-4 font-serif text-sm text-ink-muted">{note}</p>
    </article>
  );
}
