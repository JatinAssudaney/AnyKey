import { describe, expect, it } from 'vitest';
import { matchesPattern, parseMatchPattern } from './matchPattern';
import type { UrlParts } from './url';

function url(href: string): UrlParts {
  const parsed = new URL(href);
  return {
    scheme: parsed.protocol.slice(0, -1),
    host: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
  };
}

describe('matchesPattern', () => {
  it.each([
    ['<all_urls>', 'https://example.com/', true],
    ['<all_urls>', 'file:///Users/me/page.html', true],
    ['<all_urls>', 'chrome://settings/', false],
    ['*://github.com/*', 'https://github.com/wxt-dev/wxt', true],
    ['*://github.com/*', 'http://github.com/', true],
    ['*://github.com/*', 'ftp://github.com/', false],
    ['*://github.com/*', 'https://gist.github.com/', false],
    ['*://*.github.com/*', 'https://gist.github.com/', true],
    ['*://*.github.com/*', 'https://github.com/', true],
    ['*://*.github.com/*', 'https://notgithub.com/', false],
    ['https://*/*', 'https://anything.example/', true],
    ['https://*/*', 'http://anything.example/', false],
    ['*://www.youtube.com/watch*', 'https://www.youtube.com/watch?v=abc', true],
    ['*://www.youtube.com/watch*', 'https://www.youtube.com/feed/trending', false],
    ['*://example.com/a?b=*', 'https://example.com/a?b=1', true],
    ['*://example.com/a.b', 'https://example.com/aXb', false],
    ['*://localhost/*', 'http://localhost:5173/', true],
    ['*://localhost:5173/*', 'http://localhost:5173/app', true],
    ['*://localhost:5173/*', 'http://localhost:3000/app', false],
    ['http://localhost:80/*', 'http://localhost/', true],
    ['*://localhost:*/*', 'http://localhost:1234/', true],
    ['*://[::1]/*', 'http://[::1]:8080/', true],
    ['file:///Users/*', 'file:///Users/me/page.html', true],
  ])('%s against %s: %s', (pattern, href, expected) => {
    expect(matchesPattern(pattern, url(href))).toBe(expected);
  });

  it('ignores the fragment', () => {
    expect(matchesPattern('*://example.com/page', url('https://example.com/page#top'))).toBe(true);
  });

  it('matches hosts case-insensitively', () => {
    expect(matchesPattern('*://GitHub.com/*', url('https://github.com/'))).toBe(true);
  });
});

describe('parseMatchPattern', () => {
  it.each([
    'github.com',
    '*://github.com',
    'chrome://settings/*',
    'javascript://x/*',
    '*://*github.com/*',
    '*://git*hub.com/*',
    '*://*.*/*',
    '*:///*',
    'file://host/*',
    '*://github.com:port/*',
  ])('rejects %s', (pattern) => {
    expect(parseMatchPattern(pattern)).toBeNull();
  });
});
