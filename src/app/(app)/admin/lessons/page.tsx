import Link from 'next/link';
import { listLessonsForAdmin } from '@/db/queries/admin';
import { LessonUpload } from './lesson-upload';
import { PublishToggle } from './publish-toggle';

export const metadata = { title: 'Lessons · Admin' };

export default async function AdminLessonsPage() {
  const rows = await listLessonsForAdmin();

  return (
    <div className="space-y-8">
      <section className="max-w-[68ch]">
        <h2 className="text-[length:var(--text-lg)] font-semibold">Upload lessons</h2>
        <p className="mt-1 font-serif text-sm text-ink-muted">
          Name each file <code className="font-mono">YYYY-MM-DD-lektion-NN.md</code>,
          matching its <code className="font-mono">slug</code>. Re-uploading a lesson
          updates it in place; learners keep their progress.
        </p>
        <div className="mt-4">
          <LessonUpload />
        </div>
      </section>

      <section>
        <h2 className="text-[length:var(--text-lg)] font-semibold">All lessons</h2>
        <p className="mt-1 font-serif text-sm text-ink-muted">
          A hidden lesson is a draft: only you can open it. Visibility is set here. A
          file&rsquo;s <code className="font-mono">publish:</code> value only applies to
          its first upload.
        </p>

        {rows.length === 0 ? (
          <p className="mt-4 font-serif text-ink-muted">Nothing uploaded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-card">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-paper">
                <tr className="border-b border-rule">
                  {[
                    'Lektion',
                    'Title',
                    'Class date',
                    'Learners',
                    'Hash',
                    'Imported',
                    'Visibility',
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
                {rows.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {String(lesson.lessonNumber ?? '—').padStart(2, '0')}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/lessons/${lesson.slug}`}
                        className="font-medium hover:text-accent hover:underline"
                      >
                        {lesson.title}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-ink-muted">
                        {lesson.level}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">
                      {lesson.classDate}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{lesson.learners}</td>
                    <td
                      className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted"
                      title={lesson.fileHash}
                    >
                      {lesson.fileHash.slice(0, 10)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">
                      {lesson.ingestedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-3 py-2.5">
                      <PublishToggle lessonId={lesson.id} publish={lesson.publish} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
