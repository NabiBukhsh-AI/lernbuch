/**
 * Persistent legend in the app shell — Section 11.1.
 *
 * The German words `der`/`die`/`das` stay in German because they are the thing
 * being learned, not interface chrome. Their meanings are labelled in English.
 *
 * Section 16.6: colour is never the sole carrier of meaning, so each chip
 * carries the article text itself as well as its hue.
 */
export function GenderLegend() {
  return (
    <ul
      aria-label="Article colours"
      className="flex items-center gap-3 font-mono text-xs"
    >
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-gender-m" />
        <span lang="de" className="text-gender-m">
          der
        </span>
        <span className="text-ink-muted">masc.</span>
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-gender-f" />
        <span lang="de" className="text-gender-f">
          die
        </span>
        <span className="text-ink-muted">fem.</span>
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-gender-n" />
        <span lang="de" className="text-gender-n">
          das
        </span>
        <span className="text-ink-muted">neut.</span>
      </li>
      <li className="flex items-center gap-1.5">
        <span lang="de" className="gender-plural-underline">
          die
        </span>
        <span className="text-ink-muted">plural</span>
      </li>
    </ul>
  );
}
