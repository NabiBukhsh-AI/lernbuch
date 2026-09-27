/** Normalisation pipeline — ARCHITECTURE.md Section 12.1. */

/** Typographic characters learners paste in from Word or a phone keyboard. */
const TYPOGRAPHIC: Array<[RegExp, string]> = [
  [/[‘’‚‛]/g, "'"], // ' ' ‚ ‛
  [/[“”„‟]/g, '"'], // " " „ ‟
  [/[–—−]/g, '-'], // – — −
  [/…/g, '...'],
  [/ /g, ' '], // non-breaking space
];

export type NormaliseOptions = {
  /** Strip one trailing `.`, `!` or `?`. */
  stripTerminal?: boolean;
};

/**
 * Steps 1 to 3 of Section 12.1, in order:
 *   1. trim, collapse internal whitespace
 *   2. Unicode NFC, typographic quotes and dashes to ASCII
 *   3. strip a single trailing . ! or ?
 *
 * NFC matters more than it looks: an "ä" typed on a Mac can arrive as `a` plus
 * a combining diaeresis, which is a different string from the precomposed `ä`
 * the lesson author wrote, and would otherwise be graded wrong.
 */
export function normalise(value: string, options: NormaliseOptions = {}): string {
  let out = value.normalize('NFC');

  for (const [pattern, replacement] of TYPOGRAPHIC) {
    out = out.replace(pattern, replacement);
  }

  out = out.trim().replace(/\s+/g, ' ');

  if (options.stripTerminal) {
    out = out.replace(/[.!?]$/, '').trimEnd();
  }

  return out;
}

/** The single trailing `.`/`!`/`?`, or '' when there is none. */
export function terminalPunctuation(value: string): string {
  const match = /[.!?]$/.exec(normalise(value));
  return match ? match[0] : '';
}

/**
 * Collapses the four German special characters to their ASCII digraphs.
 *
 * Section 3.8: typing `ae/oe/ue/ss` is accepted by the grader but flagged as a
 * spelling warning, never silently accepted as perfect. Folding both sides and
 * comparing is how "same word, wrong spelling" is told apart from "wrong word".
 *
 * Applied after lowercasing is avoided on purpose — `Ä` folds to `Ae`, not
 * `AE`, which is what a learner actually types.
 */
export function foldUmlauts(value: string): string {
  return value
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue');
}

/** True when the value uses a digraph where the expected form has an umlaut. */
export function usesDigraphSpelling(user: string, expected: string): boolean {
  return user !== expected && foldUmlauts(user) === foldUmlauts(expected);
}

export function tokenise(value: string): string[] {
  const trimmed = normalise(value, { stripTerminal: true });
  return trimmed.length === 0 ? [] : trimmed.split(' ');
}

/** Levenshtein distance, iterative with a single row of state. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + cost,
      );
    }
    previous = current;
  }

  return previous[b.length]!;
}

/**
 * German articles in every form taught up to A2, used to tell "wrong article,
 * right noun" (Section 12.2) apart from an ordinary wrong word.
 */
const ARTICLES = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'eines',
  'kein',
  'keine',
  'keinen',
  'keinem',
  'keiner',
  'keines',
]);

export function isArticle(token: string): boolean {
  return ARTICLES.has(token.toLowerCase());
}
