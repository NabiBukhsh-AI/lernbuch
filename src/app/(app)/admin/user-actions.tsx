'use client';

import { useState, useTransition } from 'react';
import { Ban, Check, Copy, KeyRound, RotateCcw, Trash2 } from 'lucide-react';
import { deleteUser, resetUserPassword, setUserSuspended } from '@/actions/admin';
import { Button } from '@/components/ui/button';

export function UserActions({
  userId,
  username,
  suspended,
}: {
  userId: string;
  username: string;
  suspended: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleSuspended() {
    const verb = suspended ? 'Restore' : 'Suspend';
    if (!confirm(`${verb} @${username}?`)) return;
    startTransition(() => setUserSuspended({ userId, suspended: !suspended }));
  }

  function resetPassword() {
    if (
      !confirm(`Set a new random password for @${username}? Their old one stops working.`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await resetUserPassword({ userId });
      setPassword(result.password);
      setCopied(false);
    });
  }

  function remove() {
    if (!confirm(`Delete @${username} and all of their progress? This cannot be undone.`))
      return;
    startTransition(() => deleteUser({ userId }));
  }

  async function copy() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
  }

  const icon = 'size-4';
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={toggleSuspended}
          aria-label={suspended ? `Restore @${username}` : `Suspend @${username}`}
          title={suspended ? 'Restore' : 'Suspend'}
        >
          {suspended ? (
            <RotateCcw aria-hidden className={icon} />
          ) : (
            <Ban aria-hidden className={icon} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={resetPassword}
          aria-label={`Reset password for @${username}`}
          title="Reset password"
        >
          <KeyRound aria-hidden className={icon} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          onClick={remove}
          aria-label={`Delete @${username}`}
          title="Delete"
          className="hover:text-warn"
        >
          <Trash2 aria-hidden className={icon} />
        </Button>
      </div>

      {password ? (
        <output className="flex items-center gap-2 rounded-sm border border-rule bg-paper px-2 py-1 text-xs">
          <span className="text-ink-muted">New password:</span>
          <code className="font-mono">{password}</code>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy password"
            className="text-ink-muted hover:text-ink"
          >
            {copied ? (
              <Check aria-hidden className="size-3.5" />
            ) : (
              <Copy aria-hidden className="size-3.5" />
            )}
          </button>
        </output>
      ) : null}
    </div>
  );
}
