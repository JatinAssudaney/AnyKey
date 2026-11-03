import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { listNodes, rich } from './rich';

const html = (node: React.ReactNode): string => renderToStaticMarkup(<>{node}</>).replaceAll('&#x27;', "'");

describe('rich', () => {
  it('puts elements where the message has their names', () => {
    expect(html(rich('popup.cheatsheetHint', { keys: <kbd>?</kbd> }))).toBe(
      'Press <kbd>?</kbd> on the page to see every shortcut.',
    );
  });

  it('picks the plural form from the count', () => {
    const one = rich('popup.yielded', { keys: <kbd>j</kbd>, site: 'GitHub' }, 1);
    expect(html(one)).toBe("On this page, <kbd>j</kbd> runs GitHub's own shortcut instead of AnyKey's.");
    const many = rich('popup.yielded', { keys: <kbd>j</kbd>, site: 'GitHub' }, 2);
    expect(html(many)).toBe("On this page, <kbd>j</kbd> run GitHub's own shortcuts instead of AnyKey's.");
  });
});

describe('listNodes', () => {
  it('joins elements the way the language joins a list', () => {
    expect(html(listNodes([<b key="a">a</b>]))).toBe('<b>a</b>');
    expect(html(listNodes([<b key="a">a</b>, <b key="b">b</b>, <b key="c">c</b>]))).toBe(
      '<b>a</b>, <b>b</b>, and <b>c</b>',
    );
  });
});
