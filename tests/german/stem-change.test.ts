/**
 * Stem-change detection — Lektion 02's instruction block item 3.
 *
 * "highlight the changed vowel inside the du and er forms only".
 *
 * The interesting cases are the ones where the change is not one letter for
 * one: e -> ie adds a character, and a -> ä replaces one.
 */
import { describe, expect, it } from 'vitest';
import { splitStemChange } from '@/components/german/ConjugationTable';

describe('splitStemChange', () => {
  it('finds a one-for-one vowel swap (a -> ä)', () => {
    expect(splitStemChange('fähr', 'fahr')).toEqual({
      before: 'f',
      changed: 'ä',
      after: 'hr',
    });
  });

  it('finds a one-for-two vowel change (e -> ie)', () => {
    expect(splitStemChange('lies', 'les')).toEqual({
      before: 'l',
      changed: 'ie',
      after: 's',
    });
  });

  it('finds a change in the middle of a longer stem (e -> i)', () => {
    expect(splitStemChange('sprich', 'sprech')).toEqual({
      before: 'spr',
      changed: 'i',
      after: 'ch',
    });
  });

  it('handles a -> ä with a following consonant cluster', () => {
    expect(splitStemChange('wäsch', 'wasch')).toEqual({
      before: 'w',
      changed: 'ä',
      after: 'sch',
    });
  });

  it('handles au -> äu', () => {
    expect(splitStemChange('läuf', 'lauf')).toEqual({
      before: 'l',
      changed: 'äu',
      after: 'f',
    });
  });

  it('returns null when the stem does not move', () => {
    expect(splitStemChange('verkauf', 'verkauf')).toBeNull();
    expect(splitStemChange('spiel', 'spiel')).toBeNull();
  });

  it('never reports an empty change', () => {
    const result = splitStemChange('geb', 'geb');
    expect(result).toBeNull();
  });
});
