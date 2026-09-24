import { describe, expect, it } from 'vitest';
import { normalizeText, sameText, truncate } from './text';

describe('normalizeText', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeText('  Star\n\t this  repo ')).toBe('Star this repo');
  });
});

describe('sameText', () => {
  it('ignores case, spacing and numbers', () => {
    expect(sameText('Like 1,203', 'Like 1,204')).toBe(true);
    expect(sameText('  LIKE ', 'like')).toBe(true);
    expect(sameText('v1.2.3 notes', 'v4.5 notes')).toBe(true);
  });

  it('tells different words apart', () => {
    expect(sameText('Dislike', 'Like')).toBe(false);
    expect(sameText('Like it', 'Like')).toBe(false);
  });

  it('never matches saved text with no words in it', () => {
    expect(sameText('', '')).toBe(false);
    expect(sameText('1,203', '1,204')).toBe(false);
    expect(sameText('...', '...')).toBe(false);
    expect(sameText('★', '★')).toBe(false);
  });
});

describe('truncate', () => {
  it('keeps short text as it is', () => {
    expect(truncate('Star', 4)).toBe('Star');
  });

  it('cuts long text with an ellipsis, within the limit', () => {
    expect(truncate('Star this repository', 5)).toBe('Star…');
  });

  it('never splits a surrogate pair', () => {
    expect(truncate('ab😀cd', 4)).toBe('ab…');
  });
});
