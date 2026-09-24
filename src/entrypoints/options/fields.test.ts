// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isValidSelector, normalizeHost } from './fields';

describe('normalizeHost', () => {
  it.each([
    ['github.com', 'github.com'],
    ['  GitHub.com ', 'github.com'],
    ['https://github.com/wxt-dev/wxt?tab=readme', 'github.com'],
    ['localhost:3000', 'localhost'],
    ['http://[::1]:8080/', '[::1]'],
    ['', ''],
    ['not a site', ''],
    ['file:///Users/me/page.html', ''],
  ])('reads %j as %j', (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });
});

describe('isValidSelector', () => {
  it.each(['button.star', '[data-testid="like"]', '#player >>> button.play', 'x-a>>>x-b >>> input'])('accepts %s', (selector) => {
    expect(isValidSelector(selector)).toBe(true);
  });

  it.each(['', 'button[', '>>> button', 'x-player >>>', 'a >>> >>> b'])('rejects %j', (selector) => {
    expect(isValidSelector(selector)).toBe(false);
  });
});
