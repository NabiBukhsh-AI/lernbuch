/**
 * Text answer comparison and the tolerance rules — ARCHITECTURE.md Section 12.2.
 *
 * | Situation                         | Lenient (default)      | Strict |
 * | ae/oe/ue/ss for ä/ö/ü/ß           | correct + spelling note| almost |
 * | Noun not capitalised              | almost + note          | wrong  |
 * | Sentence not capitalised at start | correct + note         | almost |
 * | Levenshtein 1 on a word > 4 chars | almost, shows the diff | wrong  |
 * | Wrong article, right noun         | wrong + gender note    | wrong  |
 * | Terminal punctuation differs      | correct + note         | correct + note |
 */
import {
  foldUmlauts,
  isArticle,
  levenshtein,
  normalise,
  terminalPunctuation,
  tokenise,
} from './normalise';
import { VERDICT_RANK, worst, type GradeNote, type Verdict } from './types';

export type TextComparison = { verdict: Verdict; notes: GradeNote[] };

const foldLower = (value: string) => foldUmlauts(value).toLowerCase();

/**
 * Compares one user answer against one expected answer.
 *
 * `isSentence` marks the full-sentence translation types, where Section 12.1
 * says terminal punctuation is checked but only ever produces a note.
 */
export function compareText(
  user: string,
  expected: string,
  options: { strict: boolean; isSentence?: boolean },
): TextComparison {
  const { strict } = options;
  const notes: GradeNote[] = [];

  const u = normalise(user, { stripTerminal: true });
  const e = normalise(expected, { stripTerminal: true });

  if (u.length === 0) {
    return {
      verdict: 'wrong',
      notes: [{ code: 'empty_answer', message: 'No answer given.', expected: e }],
    };
  }

  // Terminal punctuation never changes the verdict, in either mode.
  const userTerminal = terminalPunctuation(user);
  const expectedTerminal = terminalPunctuation(expected);
  if (userTerminal !== expectedTerminal) {
    notes.push({
      code: 'terminal_punctuation',
      message: expectedTerminal
        ? `German sentences end in "${expectedTerminal}". Not counted against you here.`
        : 'No punctuation was expected at the end. Not counted against you here.',
      expected: expectedTerminal,
      got: userTerminal,
    });
  }

  if (u === e) return { verdict: 'correct', notes };

  /* Same letters, differing only by umlaut spelling and/or capitalisation. */
  if (foldLower(u) === foldLower(e)) {
    const verdicts: Verdict[] = [];

    const hasUmlautIssue = u.toLowerCase() !== e.toLowerCase();
    if (hasUmlautIssue) {
      notes.push({
        code: 'umlaut_spelling',
        message: `Write it with the umlaut: "${e}". Typing ae/oe/ue/ss is understood, but it is a spelling slip in an exam.`,
        expected: e,
        got: u,
      });
      // Section 3.8: accepted, never silently accepted as perfect.
      verdicts.push(strict ? 'almost' : 'correct');
    }

    const hasCaseIssue = foldUmlauts(u) !== foldUmlauts(e);
    if (hasCaseIssue) {
      const userTokens = tokenise(foldUmlauts(u));
      const expectedTokens = tokenise(foldUmlauts(e));

      // A capital letter mid-sentence in German means a noun.
      const midSentence = userTokens.some(
        (token, index) => index > 0 && token !== expectedTokens[index],
      );

      if (midSentence) {
        notes.push({
          code: 'noun_capitalisation',
          message: 'German nouns are always capitalised, everywhere in the sentence.',
          expected: e,
          got: u,
        });
        verdicts.push(strict ? 'wrong' : 'almost');
      } else {
        notes.push({
          code: 'sentence_capitalisation',
          message: 'A sentence starts with a capital letter.',
          expected: e,
          got: u,
        });
        verdicts.push(strict ? 'almost' : 'correct');
      }
    }

    return { verdict: worst(verdicts), notes };
  }

  /* Different words. Look for a single substituted token. */
  const userTokens = tokenise(u);
  const expectedTokens = tokenise(e);

  if (userTokens.length === expectedTokens.length) {
    const differing = userTokens
      .map((token, index) =>
        foldLower(token) === foldLower(expectedTokens[index]!) ? -1 : index,
      )
      .filter((index) => index !== -1);

    if (differing.length === 1) {
      const index = differing[0]!;
      const got = userTokens[index]!;
      const want = expectedTokens[index]!;

      // Wrong article, right noun — wrong in both modes, but the note has to
      // name the gender and the case rather than just marking it incorrect.
      if (isArticle(got) && isArticle(want)) {
        return {
          verdict: 'wrong',
          notes: [
            ...notes,
            {
              code: 'wrong_article',
              message: `The article is "${want}", not "${got}". Check the gender of the noun and which case the verb puts it in.`,
              expected: want,
              got,
            },
          ],
        };
      }

      if (levenshtein(foldLower(got), foldLower(want)) === 1 && want.length > 4) {
        return {
          verdict: strict ? 'wrong' : 'almost',
          notes: [
            ...notes,
            {
              code: 'typo',
              message: `One letter out: you wrote "${got}", the answer is "${want}".`,
              expected: want,
              got,
            },
          ],
        };
      }
    }
  }

  return { verdict: 'wrong', notes };
}

/**
 * Compares against the canonical answer and every entry in `accept`, keeping
 * the most favourable outcome.
 *
 * Section 12.3 requires `accept` to cover legitimate alternative word orders,
 * which in German is common enough that the best match — not the first — is the
 * only fair one to report.
 */
export function compareAgainstAny(
  user: string,
  candidates: string[],
  options: { strict: boolean; isSentence?: boolean },
): TextComparison {
  if (candidates.length === 0) {
    return { verdict: 'wrong', notes: [] };
  }

  let best: TextComparison | null = null;

  for (const candidate of candidates) {
    const result = compareText(user, candidate, options);
    if (
      !best ||
      VERDICT_RANK[result.verdict] < VERDICT_RANK[best.verdict] ||
      (VERDICT_RANK[result.verdict] === VERDICT_RANK[best.verdict] &&
        result.notes.length < best.notes.length)
    ) {
      best = result;
    }
    if (best.verdict === 'correct' && best.notes.length === 0) break;
  }

  return best!;
}
