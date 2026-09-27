'use client';

import { useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { setLessonPublished } from '@/actions/admin';
import { Button } from '@/components/ui/button';

export function PublishToggle({
  lessonId,
  publish,
}: {
  lessonId: string;
  publish: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-pressed={publish}
      onClick={() =>
        startTransition(() => setLessonPublished({ lessonId, publish: !publish }))
      }
      className={publish ? 'text-ok' : 'text-ink-muted'}
    >
      {publish ? (
        <Eye aria-hidden className="size-4" />
      ) : (
        <EyeOff aria-hidden className="size-4" />
      )}
      {publish ? 'Published' : 'Hidden'}
    </Button>
  );
}
