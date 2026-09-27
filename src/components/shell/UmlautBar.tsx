'use client';

import { useCallback, useEffect } from 'react';

/**
 * Persistent umlaut accessory strip — Section 3.8.
 *
 * Clicking a key inserts it at the caret of whichever text field is focused.
 * Alt+a/o/u/s do the same from the keyboard, and Alt+Shift gives the capital.
 * `ß` has no capital in ordinary writing, so Alt+Shift+s stays `ß`.
 */
const KEYS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'] as const;

const SHORTCUTS: Record<string, { lower: string; upper: string }> = {
  a: { lower: 'ä', upper: 'Ä' },
  o: { lower: 'ö', upper: 'Ö' },
  u: { lower: 'ü', upper: 'Ü' },
  s: { lower: 'ß', upper: 'ß' },
};

type TextField = HTMLInputElement | HTMLTextAreaElement;

function isTextField(el: Element | null): el is TextField {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  return (
    el instanceof HTMLInputElement && /^(text|search|password|email|url)$/.test(el.type)
  );
}

export function UmlautBar() {
  const insert = useCallback((char: string) => {
    const el = document.activeElement;
    if (!isTextField(el)) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;

    // Uses the native setter so React's onChange still fires and controlled
    // inputs do not silently discard the character.
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, el.value.slice(0, start) + char + el.value.slice(end));

    el.setSelectionRange(start + char.length, start + char.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;

      const mapping = SHORTCUTS[event.key.toLowerCase()];
      if (!mapping) return;
      if (!isTextField(document.activeElement)) return;

      event.preventDefault();
      insert(event.shiftKey ? mapping.upper : mapping.lower);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [insert]);

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Insert umlauts">
      {KEYS.map((char) => (
        <button
          key={char}
          type="button"
          lang="de"
          // Keeps focus in the text field so the caret position survives.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => insert(char)}
          className="size-11 rounded-sm border border-rule bg-card font-mono text-base text-ink hover:bg-accent-soft"
        >
          {char}
        </button>
      ))}
      <kbd className="ml-2 hidden font-mono text-xs text-ink-muted sm:inline">
        Alt+a Alt+o Alt+u Alt+s
      </kbd>
    </div>
  );
}
