'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signupAction, type SignupState } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { FieldError, FormAlert } from '@/components/ui/form-alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating account …' : 'Create account'}
    </Button>
  );
}

type Field = keyof NonNullable<SignupState['fieldErrors']>;

export function SignupForm() {
  const [state, formAction] = useActionState<SignupState, FormData>(signupAction, {});
  const errors = state.fieldErrors ?? {};

  /** Ties an input to its message, so a screen reader reads the error with the field. */
  const describe = (field: Field, hint?: string) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : hint,
  });

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Honeypot: off-screen, skipped by keyboard and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">Your name</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          defaultValue={state.values?.displayName}
          maxLength={40}
          required
          autoFocus
          className="font-serif"
          {...describe('displayName')}
        />
        <FieldError id="displayName-error" message={errors.displayName} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.values?.username}
          maxLength={24}
          required
          {...describe('username', 'username-hint')}
        />
        {errors.username ? (
          <FieldError id="username-error" message={errors.username} />
        ) : (
          <p id="username-hint" className="text-xs text-ink-muted">
            3–24 letters, digits or underscores. You sign in with this.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          maxLength={128}
          required
          {...describe('password', 'password-hint')}
        />
        {errors.password ? (
          <FieldError id="password-error" message={errors.password} />
        ) : (
          <p id="password-hint" className="text-xs text-ink-muted">
            At least 8 characters. A short sentence is easier to remember than a code.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          {...describe('confirm')}
        />
        <FieldError id="confirm-error" message={errors.confirm} />
      </div>

      {state.error ? <FormAlert>{state.error}</FormAlert> : null}

      <SubmitButton />
    </form>
  );
}
