'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { changePassword, deleteAccount, type AccountState } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

function Submit({
  children,
  pendingLabel,
  variant,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: 'default' | 'outline';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function Result({ state }: { state: AccountState }) {
  if (state.error) return <FormAlert>{state.error}</FormAlert>;
  if (state.ok) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-ok">
        <CheckCircle2 aria-hidden className="size-4" />
        {state.ok}
      </p>
    );
  }
  return null;
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(changePassword, {});

  return (
    <form action={action} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current">Current password</Label>
        <PasswordInput
          id="current"
          name="current"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next">New password</Label>
        <PasswordInput
          id="next"
          name="next"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-next">Confirm new password</Label>
        <PasswordInput
          id="confirm-next"
          name="confirm"
          autoComplete="new-password"
          required
        />
      </div>
      <Result state={state} />
      <Submit pendingLabel="Saving …" variant="outline">
        Change password
      </Submit>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useActionState<AccountState, FormData>(deleteAccount, {});

  return (
    <form action={action} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="confirm-delete">
          Type <span className="font-mono normal-case text-ink">{username}</span> to
          confirm
        </Label>
        <Input id="confirm-delete" name="confirm" autoComplete="off" required />
      </div>
      <Result state={state} />
      <Submit pendingLabel="Deleting …" variant="outline">
        Delete my account
      </Submit>
    </form>
  );
}
