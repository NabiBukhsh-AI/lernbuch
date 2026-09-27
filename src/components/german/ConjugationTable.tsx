import { cn } from '@/lib/utils';

export type Praesens = {
  ich: string;
  du: string;
  er: string;
  wir: string;
  ihr: string;
  sie: string;
};

export type VerbForms = {
  regular?: boolean | null;
  separable?: boolean | null;
  aux?: 'haben' | 'sein' | null;
  partizip2?: string | null;
  praesens?: Praesens | null;
  stemChange?: string | null;
  takesCase?: string | null;
};

const PERSONS: Array<[keyof Praesens, string]> = [
  ['ich', 'I'],
  ['du', 'you (informal)'],
  ['er', 'he / she / it'],
  ['wir', 'we'],
  ['ihr', 'you all'],
  ['sie', 'they / you (formal)'],
];

/** Only these two ever take the stem change in the present tense. */
const CHANGING = new Set<keyof Praesens>(['du', 'er']);

/** `fahren` -> `fahr`, `sammeln` -> `sammel`. */
function infinitiveStem(infinitive: string): string {
  return infinitive.replace(/e?n$/, '');
}

/** `fährst` -> `fähr`, `fährt` -> `fähr`. */
function formStem(form: string, person: keyof Praesens): string {
  if (person === 'du') return form.replace(/e?st$/, '');
  if (person === 'er') return form.replace(/e?t$/, '');
  return form;
}

/**
 * Splits a changed stem into the part before the vowel change, the changed
 * vowel itself, and the part after.
 *
 * Comparing character by character is not enough, because a stem change is not
 * always one letter for one: `fahren` -> `fährst` swaps a for ä, but `lesen` ->
 * `liest` replaces e with ie. Taking the longest common prefix and the longest
 * common suffix leaves exactly the changed vowel in the middle, whichever it is.
 */
export function splitStemChange(
  stem: string,
  reference: string,
): { before: string; changed: string; after: string } | null {
  if (stem === reference) return null;

  let prefix = 0;
  while (
    prefix < stem.length &&
    prefix < reference.length &&
    stem[prefix] === reference[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < stem.length - prefix &&
    suffix < reference.length - prefix &&
    stem[stem.length - 1 - suffix] === reference[reference.length - 1 - suffix]
  ) {
    suffix++;
  }

  let start = prefix;
  let end = stem.length - suffix;
  if (end <= start) return null;

  /*
   * Widen the span to the whole vowel run.
   *
   * The minimal diff of `les` -> `lies` is a single inserted `i`, which would
   * highlight `l[i]es`. But the lesson teaches this as e -> ie, and its own
   * `stemChange` text says so, so the highlight has to cover `l[ie]s` to match
   * what the learner is being told. Same for au -> äu.
   */
  const isVowel = (character: string) => /[aeiouäöü]/i.test(character);
  while (start > 0 && isVowel(stem[start - 1]!) && isVowel(stem[start]!)) start--;
  while (end < stem.length && isVowel(stem[end]!) && isVowel(stem[end - 1]!)) end++;

  return {
    before: stem.slice(0, start),
    changed: stem.slice(start, end),
    after: stem.slice(end),
  };
}

/**
 * Rule 3.2, sharpened by Lektion 02's instruction block: highlight the changed
 * vowel inside the `du` and `er` forms only, and dim the four unchanged rows so
 * the two that move stand out without needing to be read.
 */
export function ConjugationTable({
  infinitive,
  forms,
  className,
}: {
  infinitive: string;
  forms: VerbForms;
  className?: string;
}) {
  const praesens = forms.praesens;
  if (!praesens) return null;

  const hasStemChange = Boolean(forms.stemChange);
  const reference = infinitiveStem(infinitive);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse font-mono text-sm">
        <caption className="mb-2 text-left font-serif text-sm text-ink-muted">
          Präsens — <span lang="de">{infinitive}</span>
          {forms.aux ? (
            <>
              {' · '}
              <span lang="de">{forms.aux}</span>
              {forms.partizip2 ? (
                <>
                  {' '}
                  <span lang="de">{forms.partizip2}</span>
                </>
              ) : null}
            </>
          ) : null}
        </caption>
        <tbody>
          {PERSONS.map(([person, english]) => {
            const form = praesens[person];
            const isChangingRow = hasStemChange && CHANGING.has(person);
            const split = isChangingRow
              ? splitStemChange(formStem(form, person), reference)
              : null;

            // Dim the rows that do not move, so the two that do carry the eye.
            const dimmed = hasStemChange && !isChangingRow;

            return (
              <tr
                key={person}
                className={cn(
                  'border-b border-rule last:border-0',
                  dimmed && 'opacity-45',
                )}
              >
                <th
                  scope="row"
                  className="w-24 py-1.5 text-left font-normal text-ink-muted"
                >
                  <span lang="de">{person}</span>
                </th>
                <td className="py-1.5">
                  <span lang="de">
                    {split ? (
                      <>
                        {split.before}
                        <mark className="rounded-[2px] bg-accent-soft px-0.5 font-semibold text-accent">
                          {split.changed}
                        </mark>
                        {split.after}
                        {form.slice(formStem(form, person).length)}
                        <span className="sr-only"> (stem vowel changes here)</span>
                      </>
                    ) : (
                      form
                    )}
                  </span>
                </td>
                <td className="py-1.5 font-serif text-xs text-ink-muted">{english}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {forms.stemChange ? (
        <p className="mt-2 font-serif text-sm text-ink-muted">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">
            Stem change
          </span>{' '}
          {forms.stemChange}
        </p>
      ) : null}
    </div>
  );
}
