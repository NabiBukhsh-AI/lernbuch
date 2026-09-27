import { AlertTriangle } from 'lucide-react';

/** Never a red fill: red means feminine here. Amber, plus an icon, plus the text. */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 border-l-2 border-warn bg-warn-soft px-3 py-2 text-sm text-ink"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
      {children}
    </p>
  );
}

/** A per-field message, tied to its input through `id` / `aria-describedby`. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-warn">
      {message}
    </p>
  );
}
