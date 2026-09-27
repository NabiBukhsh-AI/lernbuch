import { cn } from '@/lib/utils';

export type GermanCase = 'NOM' | 'AKK' | 'DAT' | 'GEN';

export type CaseSegment = { text: string; case: GermanCase };

/** Section 16.2 reserves a colour per case; the chip also carries the label. */
const CASE_CLASS: Record<GermanCase, string> = {
  NOM: 'text-case-nom border-case-nom',
  AKK: 'text-case-akk border-case-akk',
  DAT: 'text-case-dat border-case-dat',
  GEN: 'text-case-gen border-case-gen',
};

const CASE_NAME: Record<GermanCase, string> = {
  NOM: 'Nominativ, the subject',
  AKK: 'Akkusativ, the direct object',
  DAT: 'Dativ, the indirect object',
  GEN: 'Genitiv, possession',
};

/**
 * Rule 3.3: case is always visible.
 *
 *   Ich       sehe    den Mann.
 *   [NOM]             [AKK]
 *
 * Segments that carry no case still render, so the sentence stays whole and
 * readable rather than being reduced to only its labelled phrases.
 */
export function CaseChips({
  sentence,
  segments,
  className,
}: {
  sentence: string;
  segments: CaseSegment[];
  className?: string;
}) {
  const parts = splitBySegments(sentence, segments);

  return (
    <div className={cn('flex flex-wrap items-start gap-x-2 gap-y-3', className)}>
      {parts.map((part, index) => (
        <span key={index} className="inline-flex flex-col items-start">
          <span lang="de" className="font-serif text-[length:var(--text-prose)]">
            {part.text}
          </span>
          {part.case ? (
            <span
              title={CASE_NAME[part.case]}
              className={cn(
                'mt-0.5 border-b-2 font-mono text-[0.625rem] uppercase tracking-wider',
                CASE_CLASS[part.case],
              )}
            >
              {part.case}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * Walks the sentence once, emitting labelled segments where they occur and the
 * untouched text in between. Segments are matched in order so a phrase that
 * appears twice attaches its label to the correct occurrence.
 */
function splitBySegments(
  sentence: string,
  segments: CaseSegment[],
): Array<{ text: string; case?: GermanCase }> {
  const parts: Array<{ text: string; case?: GermanCase }> = [];
  let cursor = 0;

  for (const segment of segments) {
    const index = sentence.indexOf(segment.text, cursor);
    if (index === -1) continue;

    const gap = sentence.slice(cursor, index).trim();
    if (gap) parts.push({ text: gap });

    parts.push({ text: segment.text, case: segment.case });
    cursor = index + segment.text.length;
  }

  const tail = sentence.slice(cursor).trim();
  if (tail) parts.push({ text: tail });

  return parts.length > 0 ? parts : [{ text: sentence }];
}
