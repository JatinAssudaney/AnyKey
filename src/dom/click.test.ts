// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { clickElement, focusElement, linkOf } from './click';

function render(html: string): void {
  document.body.innerHTML = html;
}

function find(selector: string, root: Document | ShadowRoot = document): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`Nothing matches ${selector}`);
  return element;
}

// happy-dom leaves out assignedSlot, which browsers give every element: null outside a slot.
if (!('assignedSlot' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'assignedSlot', { get: () => null });
}

beforeEach(() => {
  render('');
  vi.spyOn(browser.dom, 'openOrClosedShadowRoot').mockReturnValue(null);
});

describe('clickElement', () => {
  function record(element: Element): MouseEvent[] {
    const events: MouseEvent[] = [];
    for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      element.addEventListener(type, (event) => {
        if (event instanceof MouseEvent) events.push(event);
      });
    }
    return events;
  }

  it('presses and releases like a mouse, then clicks', () => {
    render('<button>Menu</button>');
    const events = record(find('button'));
    clickElement(find('button'), { modifier: false, isMac: false });
    expect(events.map((event) => event.type)).toEqual([
      'pointerover',
      'mouseover',
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
    expect(events.every((event) => event.bubbles && event.composed && !event.ctrlKey && !event.metaKey)).toBe(true);
  });

  it('holds Ctrl, or Cmd on macOS, to ask for a new tab', () => {
    render('<a href="/next">Next</a>');
    const events = record(find('a'));
    clickElement(find('a'), { modifier: true, isMac: false });
    expect(events.at(-1)).toMatchObject({ ctrlKey: true, metaKey: false });
    clickElement(find('a'), { modifier: true, isMac: true });
    expect(events.at(-1)).toMatchObject({ ctrlKey: false, metaKey: true });
  });
});

describe('linkOf', () => {
  it('finds the link an element sits in, across shadow roots', () => {
    render('<a href="/repo"><span><x-avatar></x-avatar></span></a><a name="anchor"><b>Not a link</b></a>');
    const root = find('x-avatar').attachShadow({ mode: 'open' });
    root.innerHTML = '<img alt="avatar">';
    expect(linkOf(find('img', root))).toBe(find('a[href]'));
    expect(linkOf(find('b'))).toBeNull();
  });
});

describe('focusElement', () => {
  it('focuses a field with the caret at the end', () => {
    render('<input value="hello">');
    const input = find('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Not an input');
    expect(focusElement(input)).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(5);
  });

  it('focuses the first field inside a wrapper', () => {
    render('<div class="search"><span>Search</span><textarea>abc</textarea><input></div>');
    expect(focusElement(find('.search'))).toBe(true);
    expect(document.activeElement).toBe(find('textarea'));
  });

  it('says so when nothing took focus', () => {
    render('<div class="card"><p>Text</p><input disabled></div>');
    expect(focusElement(find('.card'))).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});
