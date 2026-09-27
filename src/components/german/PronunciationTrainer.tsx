import { SpeakButton } from './SpeakButton';

/**
 * Pronunciation trainer — the sound combinations of a lesson, each with a few
 * example words and a speak button.
 *
 * Built by reading the lesson's own pronunciation tables rather than being
 * hard-coded to one lesson: any lesson whose Aussprache section has a table
 * with an examples column gets a trainer, and the content stays authored in
 * the markdown where it belongs.
 */

export type SoundRow = {
  sound: string;
  soundsLike: string | null;
  examples: string[];
};

/** A word, not a gloss — the same test the speakable tables use. */
const GERMAN_WORD = /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*$/;

const EXAMPLE_HEADER = /(example|beispiel)/i;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

const isSeparator = (line: string) =>
  /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');

/**
 * Pulls sound-to-example rows out of the GFM tables in a markdown section.
 *
 * Only tables that actually carry an examples column are used, which skips the
 * alphabet table (letter names, no examples) while picking up the special
 * characters, the sound combinations and the vowel-length tables.
 */
export function extractSounds(markdown: string, perRow = 3): SoundRow[] {
  const lines = markdown.split('\n');
  const rows: SoundRow[] = [];

  let header: string[] | null = null;
  let exampleIndex = -1;
  let soundsLikeIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isTableLine = line.trim().startsWith('|');

    if (!isTableLine) {
      header = null;
      exampleIndex = -1;
      continue;
    }

    if (isSeparator(line)) continue;

    const cells = splitRow(line);

    if (!header) {
      // First pipe line of a block is its header.
      header = cells;
      exampleIndex = cells.findIndex((cell) => EXAMPLE_HEADER.test(cell));
      soundsLikeIndex = cells.findIndex((cell) => /sound|say|effect|name/i.test(cell));
      continue;
    }

    if (exampleIndex === -1) continue;

    const sound = cells[0] ?? '';
    const raw = cells[exampleIndex] ?? '';
    if (!sound || !raw) continue;

    const examples = raw
      .split(',')
      .map((word) => word.replace(/[`*]/g, '').trim())
      .filter((word) => GERMAN_WORD.test(word) && word.length > 1)
      .slice(0, perRow);

    if (examples.length === 0) continue;

    rows.push({
      sound: sound.replace(/[`*]/g, '').trim(),
      soundsLike:
        soundsLikeIndex >= 0 ? (cells[soundsLikeIndex] ?? null)?.trim() || null : null,
      examples,
    });
  }

  return rows;
}

export function PronunciationTrainer({ markdown }: { markdown: string }) {
  const sounds = extractSounds(markdown);
  if (sounds.length === 0) return null;

  return (
    <section className="mb-10" aria-labelledby="pronunciation-trainer">
      <h2
        id="pronunciation-trainer"
        className="font-display text-[length:var(--text-lg)] font-semibold"
      >
        Pronunciation trainer
      </h2>
      <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-muted">
        {sounds.length} sounds · tap to hear
      </p>
      <p className="mb-4 max-w-[68ch] text-sm text-ink-muted">
        Every sound from this lesson with its example words. Listen to the three together
        — the pattern is easier to hear across words than in one.
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {sounds.map((row, index) => (
          <li
            key={`${row.sound}-${index}`}
            className="rounded-sm border border-rule bg-card p-3"
          >
            <div className="flex items-baseline gap-2">
              <span
                lang="de"
                className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-sm font-semibold text-accent"
              >
                {row.sound}
              </span>
              {row.soundsLike ? (
                <span className="text-sm text-ink-muted">{row.soundsLike}</span>
              ) : null}
            </div>

            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {row.examples.map((word) => (
                <li key={word} className="inline-flex items-center gap-0.5">
                  <span lang="de" className="font-serif">
                    {word}
                  </span>
                  <SpeakButton text={word} className="size-8" />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
