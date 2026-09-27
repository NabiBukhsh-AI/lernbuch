'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  addMissedToReview,
  saveQuizAnswer,
  submitAttempt,
  type QuizOutcome,
} from '@/actions/quiz';
import { Button } from '@/components/ui/button';
import { QuizResults } from './QuizResults';
import { cn } from '@/lib/utils';

export type QuizQuestionView = {
  id: string;
  type: string;
  promptMd: string;
  given: unknown;
  points: number;
  /** Present only for practice quizzes (Section 14). */
  hint: string | null;
};

export type QuizView = {
  id: string;
  title: string;
  kind: 'practice' | 'graded' | 'review';
  timeLimitSec: number | null;
  passScore: number;
  shuffle: boolean;
  description: string | null;
};

const SINGLE_CHOICE = new Set(['mcq', 'true_false', 'gender_pick', 'case_pick']);
const PER_BLANK = new Set(['fill_blank', 'cloze']);

function given<T>(value: unknown, key: string): T | undefined {
  if (value && typeof value === 'object' && key in value) {
    return (value as Record<string, T>)[key];
  }
  return undefined;
}

/**
 * Deterministic shuffle seeded from the attempt id.
 *
 * The order has to survive a refresh: Phase 6 is done when refreshing resumes
 * at the same question, and a re-randomised order would move the questions
 * underneath the learner even though their answers were preserved.
 */
function seededOrder<T>(items: T[], seed: string): T[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const random = () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * One question per screen, progress bar, optional timer, autosave — Section 11.3.
 */
export function QuizRunner({
  quiz,
  questions,
  attemptId,
  startedAt,
  initialAnswers,
}: {
  quiz: QuizView;
  questions: QuizQuestionView[];
  attemptId: string;
  startedAt: string;
  initialAnswers: Record<string, { userAnswer: unknown; verdict: string | null }>;
}) {
  const ordered = useMemo(
    () => (quiz.shuffle ? seededOrder(questions, attemptId) : questions),
    [questions, quiz.shuffle, attemptId],
  );

  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      Object.entries(initialAnswers).map(([id, value]) => [id, value.userAnswer]),
    ),
  );
  const [hintsUsed, setHintsUsed] = useState<Record<string, number>>({});
  const [hintShown, setHintShown] = useState<Record<string, boolean>>({});

  // Resume at the first unanswered question rather than at the start.
  const [index, setIndex] = useState(() => {
    const first = ordered.findIndex((q) => !(q.id in initialAnswers));
    return first === -1 ? 0 : first;
  });

  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const question = ordered[index];
  const answered = Object.keys(answers).length;

  /* ---- optional timer ---------------------------------------------------- */
  const [remaining, setRemaining] = useState<number | null>(null);
  const submitRef = useRef<() => void>(() => {});

  /*
   * Auto-submit exactly once.
   *
   * This used to call submit on every tick where the clock had run out, which
   * meant an expired attempt fired a Server Action every second for as long as
   * the page stayed open. Besides flooding the server, it kept React in a
   * permanently pending transition, and since a Next.js Link navigation is
   * itself a transition, the whole app became impossible to navigate away
   * from. The guard and the cleared interval are both load-bearing.
   */
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!quiz.timeLimitSec) return;
    const deadline = new Date(startedAt).getTime() + quiz.timeLimitSec * 1000;
    let id: ReturnType<typeof setInterval> | undefined;

    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);

      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        if (id !== undefined) clearInterval(id);
        submitRef.current();
      }
    };

    tick();
    // Do not start ticking if the deadline had already passed on mount.
    if (!expiredRef.current) id = setInterval(tick, 1000);
    return () => {
      if (id !== undefined) clearInterval(id);
    };
  }, [quiz.timeLimitSec, startedAt]);

  const save = useCallback(
    async (questionId: string, value: unknown, hints: number) => {
      setSaving(true);
      try {
        await saveQuizAnswer({
          attemptId,
          exerciseId: questionId,
          userAnswer: value,
          hintsUsed: hints,
        });
      } finally {
        setSaving(false);
      }
    },
    [attemptId],
  );

  const finish = useCallback(() => {
    startTransition(async () => {
      const result = await submitAttempt({ attemptId });
      setOutcome(result);
    });
  }, [attemptId]);

  submitRef.current = finish;

  if (outcome) {
    return (
      <QuizResults
        outcome={outcome}
        onAddToReview={async (ids) => {
          await addMissedToReview({ exerciseIds: ids });
        }}
      />
    );
  }

  if (!question) return <p className="text-ink-muted">This quiz has no questions.</p>;

  const value = answers[question.id];
  const options = given<string[]>(question.given, 'options') ?? [];

  function setAnswer(next: unknown) {
    setAnswers((current) => ({ ...current, [question!.id]: next }));
  }

  async function goNext() {
    await save(question!.id, answers[question!.id] ?? null, hintsUsed[question!.id] ?? 0);
    if (index < ordered.length - 1) setIndex(index + 1);
    else finish();
  }

  const canHint = quiz.kind === 'practice' && question.hint;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-ink-muted">
          Question {index + 1} of {ordered.length} · {answered} answered
        </p>
        <div className="flex items-center gap-3">
          {saving ? (
            <span className="font-mono text-xs text-ink-muted">saving …</span>
          ) : null}
          {remaining !== null ? (
            <span
              role="timer"
              className={cn(
                'font-mono text-sm',
                remaining <= 30 ? 'text-warn' : 'text-ink-muted',
              )}
            >
              {formatTime(remaining)}
            </span>
          ) : null}
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={ordered.length}
        aria-label="Quiz progress"
        className="mb-6 h-1 w-full overflow-hidden rounded-full bg-rule"
      >
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${((index + 1) / ordered.length) * 100}%` }}
        />
      </div>

      <div
        className="rounded-sm border border-rule bg-card p-5"
        id={question.id.split(':').pop()}
      >
        <p lang="de" className="font-serif text-[length:var(--text-prose)]">
          {question.promptMd}
        </p>

        <div className="mt-4">
          {SINGLE_CHOICE.has(question.type) ? (
            <div className="flex flex-wrap gap-2">
              {(options.length ? options : ['true', 'false']).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 font-serif',
                    value === option
                      ? 'border-accent bg-accent-soft'
                      : 'border-rule bg-card hover:border-accent',
                  )}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={value === option}
                    onChange={() => setAnswer(option)}
                    className="accent-[var(--accent)]"
                  />
                  <span lang="de">{option}</span>
                </label>
              ))}
            </div>
          ) : PER_BLANK.has(question.type) ? (
            <input
              lang="de"
              value={Array.isArray(value) ? String(value[0] ?? '') : ''}
              onChange={(event) => setAnswer([event.target.value])}
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Your answer"
              className="min-h-11 w-full rounded-sm border border-rule bg-card px-3 py-2 font-mono focus:border-accent"
            />
          ) : (
            <input
              lang="de"
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setAnswer(event.target.value)}
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Your answer"
              className="min-h-11 w-full rounded-sm border border-rule bg-card px-3 py-2 font-serif text-[length:var(--text-prose)] focus:border-accent"
            />
          )}
        </div>

        {/* Section 14: hints exist in practice quizzes only, never in graded. */}
        {canHint ? (
          hintShown[question.id] ? (
            <p className="mt-3 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-3 py-2 font-serif text-sm">
              {question.hint}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setHintShown((c) => ({ ...c, [question.id]: true }));
                setHintsUsed((c) => ({ ...c, [question.id]: (c[question.id] ?? 0) + 1 }));
              }}
              className="mt-3 font-mono text-xs text-accent hover:underline"
            >
              Nudge me (costs 25% of this question)
            </button>
          )
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="quiet"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0 || pending}
        >
          Back
        </Button>
        <Button onClick={goNext} disabled={pending}>
          {index < ordered.length - 1 ? 'Next' : 'Finish'}
        </Button>
      </div>
    </div>
  );
}
