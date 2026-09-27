/**
 * Canonical skill tag taxonomy — ARCHITECTURE.md Appendix A.
 *
 * Tags are dot separated and hierarchical so /progress can group by the first
 * segment. The ingest script rejects unknown tags to prevent drift, which means
 * this list is the single place a new tag may be introduced.
 */
export const SKILL_TAGS = [
  // Appendix A, verbatim
  'noun.gender',
  'noun.plural',
  'noun.compound',
  'article.definite',
  'article.indefinite',
  'article.negative',
  'article.possessive',
  'case.nominativ',
  'case.akkusativ',
  'case.dativ',
  'case.genitiv',
  'pronoun.personal',
  'pronoun.possessive',
  'pronoun.reflexive',
  'verb.praesens.regular',
  'verb.praesens.irregular',
  'verb.separable',
  'verb.modal',
  'verb.perfekt.haben',
  'verb.perfekt.sein',
  'verb.praeteritum',
  'verb.imperativ',
  'verb.reflexive',
  'verb.rection',
  'adjective.endings',
  'adjective.comparison',
  'preposition.akkusativ',
  'preposition.dativ',
  'preposition.wechsel',
  'wordorder.v2',
  'wordorder.tekamolo',
  'wordorder.nebensatz',
  'wordorder.satzklammer',
  'negation.nicht',
  'negation.kein',
  'question.wfragen',
  'question.janein',
  'numbers',
  'time.uhrzeit',
  'time.datum',
  'vocab.thema',
  'phrase.redemittel',
  'pronunciation',

  /*
   * Added beyond Appendix A. Lektion 01 teaches all three and they have no
   * reasonable home among the tags above, so the alternative was failing
   * validation on genuine authored content. Recorded in CHANGELOG.md under the
   * Section 0 rule 4 process.
   */
  'alphabet',
  'orthography.grossschreibung',
  'vocab.lehnwoerter',

  /* Added for Lektion 02, per its instruction block. */
  'verb.stammwechsel',
  'negation.position',
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

const SKILL_TAG_SET: ReadonlySet<string> = new Set(SKILL_TAGS);

export function isSkillTag(value: string): value is SkillTag {
  return SKILL_TAG_SET.has(value);
}

/** Groups by the first dot-separated segment, for the /progress mastery grid. */
export function skillFamily(tag: string): string {
  const dot = tag.indexOf('.');
  return dot === -1 ? tag : tag.slice(0, dot);
}
