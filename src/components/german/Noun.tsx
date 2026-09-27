import { cn } from '@/lib/utils';

export type Gender = 'der' | 'die' | 'das' | 'plural' | 'none';

/**
 * Article colour, used app-wide — Section 3.1.
 *
 * Section 16.6 forbids colour as the sole carrier of meaning, which is why the
 * article word itself is always rendered next to the noun rather than the hue
 * standing in for it.
 */
export const ARTICLE_CLASS: Record<Gender, string> = {
  der: 'text-gender-m',
  die: 'text-gender-f',
  das: 'text-gender-n',
  plural: 'gender-plural-underline',
  none: 'text-ink',
};

const GENDER_LABEL: Record<Gender, string> = {
  der: 'masculine',
  die: 'feminine',
  das: 'neuter',
  plural: 'plural',
  none: '',
};

/**
 * Rule 3.1: nouns are never shown bare. Always article + noun + plural.
 *
 * The article renders at the same size as the noun, never smaller, because the
 * article is part of the word (Section 16.3).
 */
export function Noun({
  de,
  article = 'none',
  plural,
  showPlural = true,
  className,
}: {
  de: string;
  article?: Gender;
  plural?: string | null;
  showPlural?: boolean;
  className?: string;
}) {
  const hasArticle = article !== 'none';

  return (
    <span lang="de" className={cn('inline', className)}>
      {hasArticle ? (
        <span
          className={ARTICLE_CLASS[article]}
          title={GENDER_LABEL[article]}
          aria-label={`${article}, ${GENDER_LABEL[article]}`}
        >
          {article}{' '}
        </span>
      ) : null}
      <span className="font-medium">{de}</span>
      {showPlural && plural ? (
        <span className="text-ink-muted">
          {', '}
          <span className={ARTICLE_CLASS.plural}>die</span> {plural}
        </span>
      ) : null}
    </span>
  );
}
