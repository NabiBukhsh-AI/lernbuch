'use client';

import { useState, useTransition } from 'react';
import { markAcceptable, submitAnswer, type SubmitResult } from '@/actions/exercises';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/german/Markdown';
import { VerdictBanner } from './VerdictBanner';
import { AnswerDiff } from './AnswerDiff';
import { WordBank } from './WordBank';
import { MatchPairs } from './MatchPairs';
import { HintStack, type RevealedSolution } from './HintStack';
import { FourFormsInput } from './FourFormsInput';
import { cn } from '@/lib/utils';

export type ExerciseView = {
  id: string;
  type: string;
  orderIndex: number;
  promptMd: string;
  instructionMd: string | null;
  given: unknown;
  /**
   * Null in sealed (homework) mode. The teaching prose is deliberately absent
   * from the payload there and arrives through a Server Action once earned —
   * see HintStack and Section 14.
   */
  solutionMd: string | null;
  whyMd: string | null;
  takeawayMd: string | null;
  tips: string[];
  skillTags: string[];
  points: number;
  /** How many hints exist, never what they say. */
  hintCount?: number;
  /**
   * How many blanks a fill_blank or cloze item has. The count is not a secret —
   * the prompt already shows the ___ markers — but the answers are, so only the
   * number is sent.
   */
  blankCount?: number;
};

const SINGLE_CHOICE = new Set(['mcq', 'true_false', 'gender_pick', 'case_pick']);
const PER_BLANK = new Set(['fill_blank', 'cloze']);
const PERSONS = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];

function given<T>(value: unknown, key: string): T | undefined {
  if (value && typeof value === 'object' && key in value) {
    return (value as Record<string, T>)[key];
  }
  return undefined;
}

/**
 * Wrapper handling prompt, input, check, verdict, why panel, takeaway and tips
 * — Section 11.2.
 *
 * In classwork the tips and the why panel are open by default (Section 8.6):
 * classwork is revision, not assessment, so there is nothing to protect.
 */
export function ExerciseCard({
  exercise,
  tipsOpenByDefault = true,
  sealed = false,
  index,
}: {
  exercise: ExerciseView;
  tipsOpenByDefault?: boolean;
  /** Homework: everything sealed until asked for (Section 14). */
  sealed?: boolean;
  index: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [marked, setMarked] = useState(false);
  const [revealed, setRevealed] = useState<RevealedSolution | null>(null);

  const [text, setText] = useState('');
  const [choice, setChoice] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [blanks, setBlanks] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [cells, setCells] = useState<Record<string, string>>({});
  const [forms, setForms] = useState<Record<string, string>>({});

  const options = given<string[]>(exercise.given, 'options') ?? [];
  const tokens = given<string[]>(exercise.given, 'tokens') ?? [];
  const left = given<string[]>(exercise.given, 'left') ?? [];
  const right = given<string[]>(exercise.given, 'right') ?? [];
  const persons = given<string[]>(exercise.given, 'persons') ?? PERSONS;

  const graded = result !== null;

  /*
   * Fall back to the ___ markers visible in the prompt if the page did not send
   * a count, so an item can never render fewer boxes than it asks for.
   */
  const blankCount = Math.max(
    1,
    exercise.blankCount ?? exercise.promptMd.match(/_{2,}/g)?.length ?? 1,
  );

  function collectAnswer(): unknown {
    if (SINGLE_CHOICE.has(exercise.type)) return choice;
    if (exercise.type === 'multi_select') return selected;
    if (PER_BLANK.has(exercise.type)) return blanks;
    if (exercise.type === 'order_words') return order.map((i) => tokens[i]);
    if (exercise.type === 'match') {
      return Object.entries(pairs)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, value]);
    }
    if (exercise.type === 'conjugate') return cells;
    if (exercise.type === 'four_forms') return forms;
    return text;
  }

  function onCheck() {
    startTransition(async () => {
      const outcome = await submitAnswer({
        exerciseId: exercise.id,
        userAnswer: collectAnswer(),
      });
      setResult(outcome);
    });
  }

  function onRetry() {
    setResult(null);
    setMarked(false);
  }

  /*
   * In sealed mode the prose is not in the payload, so it comes from whichever
   * action supplied it: submitting, or explicitly asking for the answer.
   */
  const feedback = revealed ?? result?.feedback ?? null;
  const whyMd = feedback?.whyMd ?? (sealed ? null : exercise.whyMd);
  const takeawayMd = feedback?.takeawayMd ?? (sealed ? null : exercise.takeawayMd);
  const solutionMd = feedback?.solutionMd ?? (sealed ? null : exercise.solutionMd);
  const solutionLocked = result?.feedback?.solutionLocked && !revealed;

  const matchResults = result
    ? Object.fromEntries(
        result.parts.map((part) => [
          part.key,
          part.verdict === 'correct' ? ('correct' as const) : ('wrong' as const),
        ]),
      )
    : undefined;

  const freeTextTypes =
    !SINGLE_CHOICE.has(exercise.type) &&
    exercise.type !== 'multi_select' &&
    !PER_BLANK.has(exercise.type) &&
    exercise.type !== 'order_words' &&
    exercise.type !== 'match' &&
    exercise.type !== 'conjugate' &&
    exercise.type !== 'four_forms';

  return (
    <li
      className="rounded-sm border border-rule bg-card p-4"
      id={exercise.id.split(':').pop()}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-ink-muted">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-muted">
          {exercise.type.replace(/_/g, ' ')}
        </span>
        {exercise.points > 1 ? (
          <span className="font-mono text-xs text-ink-muted">{exercise.points} pts</span>
        ) : null}
      </div>

      <div className="mt-2 font-serif text-[length:var(--text-prose)]" lang="de">
        {exercise.promptMd}
      </div>

      {exercise.instructionMd ? (
        <p className="mt-1 text-sm text-ink-muted">{exercise.instructionMd}</p>
      ) : null}

      <div className="mt-3">
        {SINGLE_CHOICE.has(exercise.type) ? (
          <fieldset disabled={graded}>
            <legend className="sr-only">Choose one</legend>
            <div className="flex flex-wrap gap-2">
              {(options.length ? options : ['true', 'false']).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 font-serif',
                    choice === option
                      ? 'border-accent bg-accent-soft'
                      : 'border-rule bg-card hover:border-accent',
                  )}
                >
                  <input
                    type="radio"
                    name={exercise.id}
                    value={option}
                    checked={choice === option}
                    onChange={() => setChoice(option)}
                    className="accent-[var(--accent)]"
                  />
                  <span lang="de">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {exercise.type === 'multi_select' ? (
          <fieldset disabled={graded}>
            <legend className="sr-only">Choose all that apply</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <label
                  key={option}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 font-serif',
                    selected.includes(option)
                      ? 'border-accent bg-accent-soft'
                      : 'border-rule bg-card hover:border-accent',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(option)
                          ? current.filter((value) => value !== option)
                          : [...current, option],
                      )
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span lang="de">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {PER_BLANK.has(exercise.type) ? (
          /*
           * One input per blank, taken from the exercise itself.
           *
           * These used to be rendered from `result.parts`, which is null until
           * the answer is submitted — so a two-blank item showed one box, and
           * the "add another blank" button wrote to state nothing rendered
           * from, meaning it could never do anything. How many blanks there
           * are is a property of the exercise, not something the learner
           * should have to discover.
           */
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: blankCount }, (_, blankIndex) => {
              const part = result?.parts[blankIndex];
              const missed = part && part.verdict !== 'correct';

              return (
                <label key={blankIndex} className="inline-flex flex-col gap-1">
                  <span className="font-mono text-xs text-ink-muted">
                    {blankCount > 1 ? `blank ${blankIndex + 1}` : 'answer'}
                  </span>
                  <input
                    lang="de"
                    disabled={graded}
                    value={blanks[blankIndex] ?? ''}
                    onChange={(event) =>
                      setBlanks((current) => {
                        const next = [...current];
                        next[blankIndex] = event.target.value;
                        return next;
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !graded) onCheck();
                    }}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(
                      'min-h-11 rounded-sm border bg-card px-2 py-1.5 font-mono focus:border-accent',
                      part?.verdict === 'correct' && 'border-ok/60',
                      missed && 'border-warn/60',
                      !part && 'border-rule',
                    )}
                  />
                  {/* The expected value sits under the blank that missed it. */}
                  {missed ? (
                    <span lang="de" className="font-mono text-xs text-ink-muted">
                      {part.expected}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        ) : null}

        {exercise.type === 'order_words' ? (
          <WordBank
            tokens={tokens}
            chosen={order}
            onChange={setOrder}
            disabled={graded}
          />
        ) : null}

        {exercise.type === 'match' ? (
          <MatchPairs
            left={left}
            right={right}
            value={pairs}
            onChange={setPairs}
            disabled={graded}
            results={matchResults}
          />
        ) : null}

        {exercise.type === 'conjugate' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {persons.map((person) => (
              <label key={person} className="flex items-center gap-2">
                <span lang="de" className="w-12 font-mono text-sm text-ink-muted">
                  {person}
                </span>
                <input
                  lang="de"
                  disabled={graded}
                  value={cells[person] ?? ''}
                  onChange={(event) =>
                    setCells((current) => ({ ...current, [person]: event.target.value }))
                  }
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-11 flex-1 rounded-sm border border-rule bg-card px-2 py-1.5 font-mono focus:border-accent"
                />
              </label>
            ))}
          </div>
        ) : null}

        {exercise.type === 'four_forms' ? (
          <FourFormsInput
            baseEn={given<string>(exercise.given, 'base_en') ?? null}
            value={forms}
            onChange={setForms}
            disabled={graded}
            parts={result?.parts}
          />
        ) : null}

        {freeTextTypes ? (
          <input
            lang="de"
            disabled={graded}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !graded) onCheck();
            }}
            placeholder="Your answer"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Your answer"
            className="min-h-11 w-full rounded-sm border border-rule bg-card px-3 py-2 font-serif text-[length:var(--text-prose)] focus:border-accent"
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!graded ? (
          <Button onClick={onCheck} disabled={pending}>
            {pending ? 'Checking …' : 'Check'}
          </Button>
        ) : (
          <Button variant="quiet" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>

      {result ? (
        <div className="mt-3 space-y-3">
          <VerdictBanner
            verdict={result.verdict}
            points={result.points}
            maxPoints={exercise.points}
          />

          {result.notes.length > 0 ? (
            <ul className="space-y-1">
              {result.notes.map((note, noteIndex) => (
                <li key={noteIndex} className="font-serif text-sm text-ink-muted">
                  {note.message}
                </li>
              ))}
            </ul>
          ) : null}

          {result.verdict !== 'correct' && freeTextTypes && text && solutionMd ? (
            <>
              <AnswerDiff got={text} expected={solutionMd} />
              {/* Section 12.3: the learner can approve their own phrasing. */}
              {!marked ? (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await markAcceptable({ exerciseId: exercise.id, answer: text });
                      setMarked(true);
                    })
                  }
                  className="font-mono text-xs text-accent hover:underline"
                >
                  Mark my answer as acceptable
                </button>
              ) : (
                <p className="font-mono text-xs text-ink-muted">
                  Saved. This phrasing will be accepted next time.
                </p>
              )}
            </>
          ) : null}

          {result.parts.length > 1 ? (
            <ul className="flex flex-wrap gap-2">
              {result.parts.map((part) => (
                <li
                  key={part.key}
                  className={cn(
                    'rounded-sm border px-2 py-1 font-mono text-xs',
                    part.verdict === 'correct'
                      ? 'border-ok/50 bg-ok/10'
                      : 'border-warn/50 bg-warn-soft',
                  )}
                >
                  {part.key}: <span lang="de">{part.expected}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/*
       * Rule 3.6: solution, then reason, then the portable rule, in that order,
       * and the solution is never shown without its reason.
       */}
      {/*
       * `revealed` has to be here: in sealed mode nothing is graded yet and
       * tips are closed, so without it "Show the answer" would fetch the
       * solution and then render nothing at all.
       */}
      {(graded || revealed || (!sealed && tipsOpenByDefault)) && whyMd ? (
        <div className="mt-4 border-t border-rule pt-3">
          {solutionMd ? (
            <p className="font-serif">
              <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                Answer
              </span>{' '}
              <span lang="de" className="font-semibold">
                {solutionMd}
              </span>
            </p>
          ) : null}

          {solutionLocked ? (
            <p className="font-mono text-xs text-ink-muted">
              The answer is still locked by this item&rsquo;s reveal policy.
            </p>
          ) : null}

          <div className="mt-2">
            <span className="font-mono text-xs uppercase tracking-wider text-accent">
              Why
            </span>
            <Markdown className="mt-1 text-sm">{whyMd}</Markdown>
          </div>

          {takeawayMd ? (
            <p className="mt-2 rounded-sm bg-accent-soft px-3 py-2 font-serif text-sm">
              <span className="font-mono text-xs uppercase tracking-wider text-accent">
                Take away
              </span>{' '}
              {takeawayMd}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Section 14: in homework, everything is sealed behind these buttons. */}
      {sealed ? (
        <HintStack
          exerciseId={exercise.id}
          hintCount={exercise.hintCount ?? 0}
          onSolutionRevealed={setRevealed}
        />
      ) : null}

      {tipsOpenByDefault && exercise.tips.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 font-serif text-sm text-ink-muted marker:text-accent">
          {exercise.tips.map((tip, tipIndex) => (
            <li key={tipIndex}>{tip}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
