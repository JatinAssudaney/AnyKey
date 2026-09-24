// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { LIMITS } from '../core/schema';
import { describeTarget } from './selectorCandidates';
import { findTarget, queryAll } from './targets';

const closedRoots = new WeakMap<Element, ShadowRoot>();

function render(html: string): void {
  document.body.innerHTML = html;
}

function find(selector: string, root: Document | ShadowRoot = document): Element {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`Nothing matches ${selector}`);
  return element;
}

function attachClosed(host: Element, html: string): ShadowRoot {
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = html;
  closedRoots.set(host, root);
  return root;
}

/** Each selector the target was saved with finds the element, and only it. */
function expectFinds(element: Element): void {
  const target = describeTarget(element);
  for (const selector of [target.selector, ...(target.fallbacks ?? [])]) {
    expect(queryAll(selector), selector).toEqual([element]);
  }
  expect(findTarget(target)).toBe(element);
}

beforeEach(() => {
  render('');
  vi.spyOn(browser.dom, 'openOrClosedShadowRoot').mockImplementation((element) => closedRoots.get(element) ?? null);
});

describe('describeTarget', () => {
  it('prefers a test attribute, then an id, then a label, then classes, keeping three as fallbacks', () => {
    render(`
      <button data-testid="like-button" id="like" class="like-button style-scope"
        aria-label="like this video along with 1,203 other people">1,203</button>
      <button class="style-scope">Dislike</button>`);
    expect(describeTarget(find('#like'))).toEqual({
      selector: '[data-testid="like-button"]',
      fallbacks: ['#like', 'button[aria-label^="like this video along with"]', 'button.like-button'],
      text: 'like this video along with 1,203 other people',
      tag: 'button',
    });
  });

  it('skips generated ids and build-made classes, and keeps the text for when the page changes', () => {
    render(`
      <div id="toolbar">
        <button id=":r1:" class="css-1dbjc4n sc-bdVaJa mt-4 active">Save</button>
        <button>Cancel</button>
      </div>
      <div><button>Other</button></div>`);
    expect(describeTarget(find('#toolbar > button'))).toEqual({
      selector: '#toolbar > button:nth-of-type(1)',
      text: 'Save',
      tag: 'button',
    });
  });

  it('narrows a shared class to below the nearest unique ancestor', () => {
    render(`
      <article data-testid="post-1"><button class="vote">Upvote</button></article>
      <article data-testid="post-2"><button class="vote">Upvote</button></article>`);
    expect(describeTarget(find('[data-testid="post-2"] button'))).toMatchObject({
      selector: '[data-testid="post-2"] button.vote',
      fallbacks: ['[data-testid="post-2"] > button'],
    });
  });

  it("uses a link's address and a field's name, placeholder and type", () => {
    render(`
      <a href="/settings">Settings</a><a href="/">Home</a>
      <form><input type="search" name="q" placeholder="Search GitHub"><input name="page"></form>`);
    expect(describeTarget(find('a[href="/settings"]')).selector).toBe('a[href="/settings"]');
    const search = describeTarget(find('input[type=search]'));
    expect(search.selector).toBe('input[placeholder="Search GitHub"]');
    expect(search.fallbacks?.slice(0, 2)).toEqual(['input[name="q"]', 'input[type="search"]']);
    expect(search.text).toBe('Search GitHub');
  });

  it('steps into closed shadow roots with >>>', () => {
    render('<x-player id="player"></x-player><x-player></x-player>');
    const root = attachClosed(find('#player'), '<div><button class="play">Play</button></div>');
    const play = find('button', root);
    expect(describeTarget(play)).toMatchObject({ selector: '#player >>> button.play', text: 'Play', tag: 'button' });
    expectFinds(play);
  });

  it('keeps text only when it fits a name', () => {
    render(`<button id="long">${'word '.repeat(30)}</button>`);
    expect(describeTarget(find('#long')).text).toBeUndefined();
    expect(LIMITS.label).toBeLessThan('word '.repeat(30).trim().length);
  });

  it('finds each element of a busy page with every selector it saves', () => {
    render(`
      <header id="top"><nav><a href="/">Home</a><a href="/explore" class="nav-link">Explore</a></nav></header>
      <main>
        <ul>
          <li><a class="item" href="/a">A</a><button class="item-menu" title="Options for A">⋯</button></li>
          <li><a class="item" href="/b">B</a><button class="item-menu" title="Options for B">⋯</button></li>
        </ul>
        <div role="tablist"><span role="tab" tabindex="0">One</span><span role="tab" tabindex="-1">Two</span></div>
        <label>Email <input type="email" name="user.email"></label>
        <textarea id="comment-body"></textarea>
      </main>`);
    for (const element of document.querySelectorAll('a, button, [role=tab], input, textarea')) expectFinds(element);
  });
});
