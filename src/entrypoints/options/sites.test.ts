import { describe, expect, it } from 'vitest';
import { count, siteMatches, sortHosts } from './sites';

describe('sortHosts', () => {
  it('sorts by host, leaving out a leading "www."', () => {
    expect(sortHosts(['www.youtube.com', 'news.ycombinator.com', 'github.com', 'www.amazon.com', 'amazon.com'])).toEqual(
      ['amazon.com', 'www.amazon.com', 'github.com', 'news.ycombinator.com', 'www.youtube.com'],
    );
  });
});

describe('siteMatches', () => {
  it.each([
    ['you', true],
    ['  YouTube ', true],
    ['www.you', true],
    ['https://www.youtube.com/watch?v=1', true],
    ['github', false],
    ['https://github.com/', false],
  ])('finds www.youtube.com, with the YouTube preset, for %j: %s', (query, expected) => {
    expect(siteMatches('www.youtube.com', ['YouTube'], query)).toBe(expected);
  });

  it('finds a site by the name of its preset', () => {
    expect(siteMatches('www.reddit.com', ['Reddit'], 'redd')).toBe(true);
    expect(siteMatches('old.example.com', [], 'redd')).toBe(false);
  });

  it('finds every site for nothing typed', () => {
    expect(siteMatches('example.com', [], ' ')).toBe(true);
  });
});

describe('count', () => {
  it('says one or many', () => {
    expect([count(0, 'shortcut'), count(1, 'shortcut'), count(12, 'warning')]).toEqual([
      '0 shortcuts',
      '1 shortcut',
      '12 warnings',
    ]);
  });
});
