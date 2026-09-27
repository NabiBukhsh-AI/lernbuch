import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getLesson } from '@/db/queries/lessons';
import {
  findOpenAttempt,
  getLastResult,
  getQuizQuestions,
  getQuizzesForLesson,
} from '@/db/queries/quiz';
import { QuizStart } from '@/components/quiz/QuizStart';
import {
  QuizRunner,
  type QuizQuestionView,
  type QuizView,
} from '@/components/quiz/QuizRunner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Graded check — Section 10.
 *
 * The page only *reads* here. An attempt is created by the Start button, so
 * opening the page does not begin one: a quiz that has never been taken must
 * not already show as in progress. An attempt already in flight is resumed
 * automatically, which is what keeps the Phase 6 refresh criterion true.
 */
export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const all = await getQuizzesForLesson(lesson.id);
  const quiz = all[0];

  if (!quiz) {
    return <p className="text-ink-muted">This lesson has no quiz block.</p>;
  }

  const questions = await getQuizQuestions(quiz.id);
  if (questions.length === 0) {
    return <p className="text-ink-muted">This quiz has no questions.</p>;
  }

  const attempt = await findOpenAttempt(session.user.id, quiz.id);
  const lastResult = await getLastResult(session.user.id, quiz.id);

  const view: QuizView = {
    id: quiz.id,
    title: quiz.title,
    kind: quiz.kind,
    timeLimitSec: quiz.timeLimitSec,
    passScore: quiz.passScore,
    shuffle: quiz.shuffle,
    description: quiz.description,
  };

  const questionViews: QuizQuestionView[] = questions.map((question) => {
    const hints = Array.isArray(question.hints)
      ? (question.hints as Array<{ level: number; text: string }>)
      : [];
    return {
      id: question.id,
      type: question.type,
      promptMd: question.promptMd,
      given: question.given,
      points: question.points,
      /*
       * Section 14: hints exist in practice quizzes only, never in a graded
       * one. In a graded quiz the text is not sent at all, so it cannot be
       * read out of the payload.
       */
      hint: quiz.kind === 'practice' ? (hints[0]?.text ?? null) : null,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-[length:var(--text-lg)] font-semibold">
          {quiz.title}
        </h2>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
          {quiz.kind} · pass mark {quiz.passScore}%
          {quiz.timeLimitSec ? ` · ${Math.round(quiz.timeLimitSec / 60)} min` : ''}
        </p>
        {quiz.description ? (
          <p className="mt-2 max-w-[68ch] text-sm text-ink-muted">{quiz.description}</p>
        ) : null}
      </div>

      {attempt ? (
        <QuizRunner
          quiz={view}
          questions={questionViews}
          attemptId={attempt.attemptId}
          startedAt={attempt.startedAt}
          initialAnswers={attempt.answers}
        />
      ) : (
        <QuizStart
          quizId={quiz.id}
          timeLimitSec={quiz.timeLimitSec}
          passScore={quiz.passScore}
          questionCount={questionViews.length}
          kind={quiz.kind}
          lastResult={lastResult}
        />
      )}
    </div>
  );
}
