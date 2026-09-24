// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { findTarget, queryAll, textOf } from './targets';

/** Closed shadow roots, which only `chrome.dom` can reach. */
const closedRoots = new WeakMap<Element, ShadowRoot>();

function render(html: string): void {
  document.body.innerHTML = html;
}

function byId(id: string, root: Document | ShadowRoot = document): Element {
  const element = root.querySelector(`#${id}`);
  if (element === null) throw new Error(`No #${id}`);
  return element;
}

function attach(host: Element, html: string, mode: ShadowRootMode = 'closed'): ShadowRoot {
  const root = host.attachShadow({ mode });
  root.innerHTML = html;
  if (mode === 'closed') closedRoots.set(host, root);
  return root;
}

beforeEach(() => {
  render('');
  vi.spyOn(browser.dom, 'openOrClosedShadowRoot').mockImplementation((element) => closedRoots.get(element) ?? null);
});

describe('queryAll', () => {
  it('finds elements in the document', () => {
    render('<button id="a"></button><button id="b"></button>');
    expect(queryAll('button').map((element) => element.id)).toEqual(['a', 'b']);
  });

  it('steps into open and closed shadow roots with >>>', () => {
    render('<x-outer id="outer"></x-outer><x-open id="open"></x-open>');
    const outer = attach(byId('outer'), '<x-inner id="inner"></x-inner>');
    const inner = attach(byId('inner', outer), '<button id="deep">Play</button>');
    const open = attach(byId('open'), '<button id="shallow">Pause</button>', 'open');
    expect(queryAll('x-outer >>> x-inner >>> button')).toEqual([byId('deep', inner)]);
    expect(queryAll('#open>>>button')).toEqual([byId('shallow', open)]);
    expect(queryAll('x-outer >>> button')).toEqual([]);
  });

  it("never looks inside AnyKey's own UI", () => {
    render('<anykey-ui></anykey-ui>');
    const ui = document.querySelector('anykey-ui');
    if (ui === null) throw new Error('No UI host');
    attach(ui, '<button>Save</button>');
    expect(queryAll('anykey-ui >>> button')).toEqual([]);
  });

  it('matches nothing for invalid CSS', () => {
    render('<button></button>');
    expect(queryAll('button[')).toEqual([]);
    expect(queryAll('button >>> [')).toEqual([]);
  });
});

describe('findTarget', () => {
  it('tries the selector, then each fallback', () => {
    render('<button id="star">Star</button><button id="fork">Fork</button>');
    expect(findTarget({ selector: '#star', fallbacks: ['#fork'] })).toBe(byId('star'));
    expect(findTarget({ selector: '#gone', fallbacks: ['#also-gone', '#fork'] })).toBe(byId('fork'));
  });

  it('prefers a visible match over a hidden one found first', () => {
    render('<button id="hidden" class="star" style="display: none">Star</button><button id="shown" class="star">Star</button>');
    expect(findTarget({ selector: 'button.star' })).toBe(byId('shown'));
    expect(findTarget({ selector: '#hidden', fallbacks: ['#shown'] })).toBe(byId('shown'));
  });

  it('settles for a hidden match when nothing visible matches', () => {
    render('<button id="hidden" style="display: none">Star</button>');
    expect(findTarget({ selector: '#hidden' })).toBe(byId('hidden'));
  });

  it('falls back to the text among interactive elements, ignoring case and counts', () => {
    render('<p>Like 12</p><span role="button" id="like">like 1,204</span>');
    expect(findTarget({ selector: '#gone', text: 'Like 1,203' })).toBe(byId('like'));
  });

  it('looks for the text only among elements of the saved tag', () => {
    render('<a id="link" href="/stars">Star</a><button id="button">Star</button>');
    expect(findTarget({ selector: '#gone', text: 'Star', tag: 'button' })).toBe(byId('button'));
    expect(findTarget({ selector: '#gone', text: 'Star', tag: 'a' })).toBe(byId('link'));
  });

  it('finds the text inside closed shadow roots, but never in its own UI', () => {
    render('<x-channel id="channel"></x-channel><anykey-ui></anykey-ui>');
    const channel = attach(byId('channel'), '<button id="subscribe">Subscribe</button>');
    const ui = document.querySelector('anykey-ui');
    if (ui === null) throw new Error('No UI host');
    attach(ui, '<button>Save</button>');
    expect(findTarget({ selector: '#gone', text: 'Subscribe' })).toBe(byId('subscribe', channel));
    expect(findTarget({ selector: '#gone', text: 'Save' })).toBeNull();
  });

  it('finds nothing when nothing matches', () => {
    render('<button>Star</button>');
    expect(findTarget({ selector: '#gone', fallbacks: ['.gone'], text: 'Fork' })).toBeNull();
  });
});

describe('textOf', () => {
  it.each([
    ['<button aria-label="Close dialog"><svg></svg></button>', 'Close dialog'],
    ['<button>\n  Star\n  this  </button>', 'Star this'],
    ['<button title="More actions"></button>', 'More actions'],
    ['<input placeholder="Search GitHub">', 'Search GitHub'],
    ['<input type="submit" value="Send">', 'Send'],
    ['<a href="/"><img alt="Home"></a>', 'Home'],
    ['<div></div>', ''],
  ])('reads %s as %j', (html, expected) => {
    render(html);
    const element = document.body.firstElementChild;
    if (element === null) throw new Error('Nothing rendered');
    expect(textOf(element)).toBe(expected);
  });
});
