'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2, MinusCircle, Upload } from 'lucide-react';
import { uploadLessons, type UploadResult } from '@/actions/admin';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Upload aria-hidden className="size-4" />
      {pending ? 'Importing …' : 'Import'}
    </Button>
  );
}

const ICON: Record<UploadResult['status'], React.ReactNode> = {
  created: <CheckCircle2 aria-hidden className="size-4 shrink-0 text-ok" />,
  updated: <CheckCircle2 aria-hidden className="size-4 shrink-0 text-ok" />,
  skipped: <MinusCircle aria-hidden className="size-4 shrink-0 text-ink-muted" />,
  ignored: <MinusCircle aria-hidden className="size-4 shrink-0 text-ink-muted" />,
  failed: <AlertTriangle aria-hidden className="size-4 shrink-0 text-warn" />,
};

export function LessonUpload() {
  const [results, formAction] = useActionState<UploadResult[] | null, FormData>(
    uploadLessons,
    null,
  );

  return (
    <div className="rounded-sm border border-rule bg-card p-4">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          accept=".md,text/markdown"
          multiple
          required
          aria-label="Lesson files"
          className="min-w-0 flex-1 text-sm file:mr-3 file:min-h-9 file:rounded-sm file:border file:border-rule file:bg-paper file:px-3 file:text-sm file:text-ink hover:file:bg-accent-soft"
        />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" name="force" className="size-4 accent-[var(--accent)]" />
          Re-import unchanged files
        </label>
        <SubmitButton />
      </form>

      {results ? (
        <ul className="mt-4 space-y-2 border-t border-rule pt-4" aria-live="polite">
          {results.length === 0 ? (
            <li className="text-sm text-ink-muted">No files were selected.</li>
          ) : null}
          {results.map((result) => (
            <li key={result.file} className="flex items-start gap-2 text-sm">
              {ICON[result.status]}
              <div className="min-w-0">
                <p>
                  <span className="font-mono">{result.file}</span>{' '}
                  <span className="text-ink-muted">{result.status}</span>
                </p>
                <p className="whitespace-pre-wrap break-words font-mono text-xs text-ink-muted">
                  {result.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
