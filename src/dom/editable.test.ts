// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isEditable } from './editable';

function element(html: string): Element {
  const template = document.createElement('template');
  template.innerHTML = html;
  const first = template.content.firstElementChild;
  if (first === null) throw new Error(`No element in ${html}`);
  document.body.append(first);
  return first;
}

describe('isEditable', () => {
  it.each([
    '<input>',
    '<input type="search">',
    '<input type="email">',
    '<input type="number">',
    '<input type="date">',
    '<textarea></textarea>',
    '<select><option>a</option></select>',
    '<div contenteditable="true"></div>',
    '<div role="textbox"></div>',
    '<div role="combobox"></div>',
  ])('treats %s as a text field', (html) => {
    expect(isEditable(element(html))).toBe(true);
  });

  it.each([
    '<input type="checkbox">',
    '<input type="radio">',
    '<input type="range">',
    '<input type="button">',
    '<button>Save</button>',
    '<a href="/">Home</a>',
    '<div contenteditable="false"></div>',
    '<div role="button"></div>',
  ])('lets shortcuts work on %s', (html) => {
    expect(isEditable(element(html))).toBe(false);
  });

  it('covers children of contenteditable elements', () => {
    const editor = element('<div contenteditable="true"><p><b>bold</b></p></div>');
    const bold = editor.querySelector('b');
    expect(bold !== null && isEditable(bold)).toBe(true);
  });
});
