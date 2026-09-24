import { describe, expect, it } from 'vitest';
import { parseMatchPattern } from './matchPattern';
import { isHost, isHttpUrl, isSafeUrl, siteMatch } from './url';

describe('isSafeUrl', () => {
  it.each(['https://github.com/notifications', 'HTTP://example.com', '/settings', 'releases', '?tab=repos', '#top'])(
    'accepts %s',
    (url) => {
      expect(isSafeUrl(url)).toBe(true);
    },
  );

  it.each([
    '',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'chrome://settings',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'https://example.com/a b',
    `https://example.com/${'a'.repeat(3000)}`,
  ])('rejects %j', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});

describe('isHttpUrl', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isHttpUrl('https://example.com/')).toBe(true);
    expect(isHttpUrl('/relative')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('isHost', () => {
  const hosts = ['github.com', 'www.youtube.com', 'localhost', '127.0.0.1', '[::1]', 'my_host.local', 'example.com.'];

  it.each(hosts)('accepts %s', (host) => {
    expect(isHost(host)).toBe(true);
  });

  it.each(['', 'GitHub.com', 'https://github.com', 'github.com/x', 'github.com:80', '*.github.com', 'a b', 'a..b', `${'a'.repeat(250)}.com`])(
    'rejects %j',
    (host) => {
      expect(isHost(host)).toBe(false);
    },
  );

  it.each(hosts)('gives %s a match pattern that parses', (host) => {
    expect(siteMatch(host)).toBe(`*://${host}/*`);
    expect(parseMatchPattern(siteMatch(host))).not.toBeNull();
  });
});
