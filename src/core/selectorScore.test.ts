import { describe, expect, it } from 'vitest';
import { cssIdent, cssString, isGeneratedId, isStableClass, labelCondition } from './selectorScore';

describe('cssIdent', () => {
  // Expected values are what CSS.escape returns in browsers.
  it.each([
    ['like-button', 'like-button'],
    ['.foo#bar', '\\.foo\\#bar'],
    ['()[]{}', '\\(\\)\\[\\]\\{\\}'],
    ['a b', 'a\\ b'],
    ['a:b', 'a\\:b'],
    ['--a', '--a'],
    ['-', '\\-'],
    ['0', '\\30 '],
    ['1a', '\\31 a'],
    ['-1a', '-\\31 a'],
    ['_a', '_a'],
    ['\0', '�'],
    ['a\u007Fb', 'a\\7f b'],
    ['a\nb', 'a\\a b'],
    ['café', 'café'],
  ])('escapes %j as %j', (value, expected) => {
    expect(cssIdent(value)).toBe(expected);
  });
});

describe('cssString', () => {
  it.each([
    ['Star', '"Star"'],
    ['say "hi"', '"say \\"hi\\""'],
    ['back\\slash', '"back\\\\slash"'],
    ['a\nb', '"a\\a b"'],
    ['x >>> y', '"x \\3e \\3e \\3e  y"'],
    ['\0', '"�"'],
  ])('quotes %j as %j', (value, expected) => {
    expect(cssString(value)).toBe(expected);
  });
});

describe('isGeneratedId', () => {
  it.each([
    ':r1:',
    '«r1»',
    '_r_1_',
    '12345',
    'post-20240101',
    'a1b2c3',
    'x-3xYz1-panel',
    '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    'ember412',
    'headlessui-menu-button-3',
    'mat-input-0',
    'radix-12',
    'react-select-2-input',
  ])('%s is generated', (id) => {
    expect(isGeneratedId(id)).toBe(true);
  });

  it.each(['search', 'main-content', 'repo-content-pjax-container', 'like', 'h1', 'step2', 'section-12', 'mat-toolbar'])(
    '%s is written by a person',
    (id) => {
      expect(isGeneratedId(id)).toBe(false);
    },
  );
});

describe('isStableClass', () => {
  it.each(['like-button', 'btn-primary', 'Header-link', 'js-navigation-open', 'ytd-toggle-button-renderer', 'MainNav'])(
    '%s names what the element is',
    (name) => {
      expect(isStableClass(name)).toBe(true);
    },
  );

  it.each([
    'active',
    'is-open',
    'has-error',
    'flex',
    'hidden',
    'mt-4',
    '-mt-2',
    'text-center',
    'bg-red-500',
    'd-flex',
    'w-full',
    'md:flex',
    'w-1/2',
    '!mt-0',
    'col-md-6',
    'sc-bdVaJa',
    'css-1dbjc4n',
    'jss12',
    'svelte-1x2y3z',
    'Button_primary__3xYz1',
    'kKDfcA',
    'item-12345',
    'a'.repeat(41),
  ])('%s is not', (name) => {
    expect(isStableClass(name)).toBe(false);
  });
});

describe('labelCondition', () => {
  it('matches a label exactly', () => {
    expect(labelCondition('aria-label', 'Search')).toBe('[aria-label="Search"]');
  });

  it('matches only the words before a number, which counts change', () => {
    expect(labelCondition('aria-label', 'like this video along with 1,234 other people')).toBe(
      '[aria-label^="like this video along with"]',
    );
  });

  it('gives up when too little is left', () => {
    expect(labelCondition('aria-label', '3 new')).toBeNull();
    expect(labelCondition('title', 'Go 2')).toBeNull();
  });
});
