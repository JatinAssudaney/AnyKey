import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { hintLabels } from './hintLabels';

const CHARS = DEFAULT_SETTINGS.hintChars;

describe('hintLabels', () => {
  it('uses single characters, in order, while there are enough', () => {
    expect(hintLabels(1, CHARS)).toEqual(['s']);
    expect(hintLabels(3, CHARS)).toEqual(['s', 'a', 'd']);
    expect(hintLabels(14, CHARS)).toEqual(Array.from(CHARS));
  });

  it('makes no labels for no hints, or from fewer than 2 characters', () => {
    expect(hintLabels(0, CHARS)).toEqual([]);
    expect(hintLabels(-3, CHARS)).toEqual([]);
    expect(hintLabels(5, 'a')).toEqual([]);
    expect(hintLabels(5, 'aaa')).toEqual([]);
    expect(hintLabels(5, '')).toEqual([]);
  });

  it('lengthens as few labels as it can, starting from the least comfortable characters', () => {
    expect(hintLabels(15, CHARS)).toEqual([...Array.from('sadfjklewcmpg'), 'hs', 'ha']);
    expect(hintLabels(30, CHARS)).toEqual([
      ...Array.from('sadfjklewcmp'),
      ...['gs', 'ga', 'gd', 'gf'],
      ...Array.from(CHARS, (char) => `h${char}`),
    ]);
    expect(hintLabels(3, 'ab')).toEqual(['a', 'ba', 'bb']);
    expect(hintLabels(4, 'ab')).toEqual(['aa', 'ab', 'ba', 'bb']);
  });

  it('counts a repeated character once', () => {
    expect(hintLabels(4, 'aab')).toEqual(['aa', 'ab', 'ba', 'bb']);
  });

  it('makes unique, prefix-free labels of the given characters, as short as possible', () => {
    for (const [chars, counts] of [
      [CHARS, [2, 13, 14, 15, 27, 28, 100, 195, 196, 197, 200, 1000, 2745, 2746, 3000]],
      ['ab', [2, 3, 5, 8, 9, 100]],
      ['qwerty', [7, 36, 37, 250]],
    ] as const) {
      for (const count of counts) {
        const labels = hintLabels(count, chars);
        expect(labels).toHaveLength(count);
        expect(new Set(labels).size).toBe(count);
        expect(labels.every((label) => Array.from(label).every((char) => chars.includes(char)))).toBe(true);
        expect(isPrefixFree(labels)).toBe(true);
        expectShortest(labels, chars.length);
      }
    }
  });
});

function isPrefixFree(labels: readonly string[]): boolean {
  const sorted = labels.toSorted();
  // In sorted order, a label that starts another comes right before one that starts with it.
  return sorted.every((label, i) => i === 0 || !label.startsWith(sorted[i - 1] ?? ''));
}

/**
 * The labels are as short as `size` characters allow: their longest length is the shortest that fits them all, the
 * other labels are one character shorter, every shorter string is used (as a label or to start longer ones), and
 * at most one group of longer labels sharing a start has room for more.
 */
function expectShortest(labels: readonly string[], size: number): void {
  const longest = Math.max(...labels.map((label) => label.length));
  expect(size ** (longest - 1)).toBeLessThan(labels.length);
  const short = labels.filter((label) => label.length === longest - 1);
  const long = labels.filter((label) => label.length === longest);
  expect(short.length + long.length).toBe(labels.length);
  const groups = Map.groupBy(long, (label) => label.slice(0, -1));
  expect(short.length + groups.size).toBe(size ** (longest - 1));
  expect([...groups.values()].filter((group) => group.length < size).length).toBeLessThanOrEqual(1);
}
