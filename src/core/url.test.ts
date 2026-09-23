import { describe, expect, it } from 'vitest';
import { isHttpUrl, isSafeUrl } from './url';

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
