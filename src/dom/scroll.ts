import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { ScrollDirection } from '../core/schema';
import { deepActiveElement, flatParent, shadowRootOf } from './shadow';

export interface ScrollOptions {
  /** Pixels for up and down. */
  step: number;
  smooth: boolean;
}

export interface Scroller {
  scroll(direction: ScrollDirection, options: ScrollOptions): void;
}

/**
 * Scrolls whatever the user is working in: the nearest scrollable ancestor of the element they last clicked or
 * focused (moving outward when it has no room left, like native scroll chaining), then the page, then the largest
 * visible scroller for apps whose page itself never scrolls.
 */
export function createScroller(ctx: ContentScriptContext): Scroller {
  let activated: WeakRef<Element> | undefined;
  let fallback: WeakRef<Element> | undefined;

  const remember = (event: Event): void => {
    const target = event.composedPath()[0];
    if (target instanceof Element) activated = new WeakRef(target);
  };
  ctx.addEventListener(window, 'pointerdown', remember, { capture: true, passive: true });
  ctx.addEventListener(window, 'focusin', remember, { capture: true, passive: true });

  function largestScroller(root: Element): Element | null {
    const cached = fallback?.deref();
    if (cached?.isConnected === true && isScrollable(cached)) return cached;
    // Cheap first: the scrollable ancestor of whatever sits in the middle of the viewport.
    for (let el = elementAtViewportCenter(); el !== null && el !== root; el = flatParent(el)) {
      if (isScrollable(el)) return el;
    }
    let best: Element | null = null;
    let bestArea = 0;
    const walker = document.createTreeWalker(pageBody() ?? document.documentElement, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (!(node instanceof Element) || node.scrollHeight <= node.clientHeight + 1) continue;
      const area = visibleArea(node);
      if (area > bestArea && isScrollable(node)) {
        best = node;
        bestArea = area;
      }
    }
    fallback = best === null ? undefined : new WeakRef(best);
    return best;
  }

  function findTarget(sign: 1 | -1): Element {
    const root = document.scrollingElement ?? document.documentElement;
    const remembered = activated?.deref();
    const start = remembered?.isConnected === true ? remembered : deepActiveElement();
    for (let el = start ?? null; el !== null && el !== root; el = flatParent(el)) {
      if (isScrollable(el) && hasRoom(el, sign)) return el;
    }
    if (rootScrollable(root)) return root;
    return largestScroller(root) ?? root;
  }

  return {
    scroll(direction, options) {
      const sign = direction === 'up' || direction === 'halfUp' || direction === 'top' ? -1 : 1;
      const target = findTarget(sign);
      const behavior: ScrollBehavior = options.smooth ? 'smooth' : 'instant';
      const viewportHeight = target === document.scrollingElement ? window.innerHeight : target.clientHeight;
      switch (direction) {
        case 'up':
        case 'down':
          target.scrollBy({ top: sign * options.step, behavior });
          return;
        case 'halfUp':
        case 'halfDown':
          target.scrollBy({ top: sign * Math.round(viewportHeight / 2), behavior });
          return;
        case 'top':
          target.scrollTo({ top: 0, behavior });
          return;
        case 'bottom':
          target.scrollTo({ top: target.scrollHeight, behavior });
          return;
      }
    },
  };
}

function isScrollable(element: Element): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  const overflow = getComputedStyle(element).overflowY;
  if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false;
  // Body's overflow applies to the page itself unless <html> sets its own.
  return element !== document.body || getComputedStyle(document.documentElement).overflowY !== 'visible';
}

function hasRoom(element: Element, sign: 1 | -1): boolean {
  return sign > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0;
}

function rootScrollable(root: Element): boolean {
  if (root.scrollHeight <= root.clientHeight + 1) return false;
  const html = getComputedStyle(document.documentElement).overflowY;
  if (html === 'hidden' || html === 'clip') return false;
  const body = pageBody();
  if (html === 'visible' && body !== null) {
    const overflow = getComputedStyle(body).overflowY;
    if (overflow === 'hidden' || overflow === 'clip') return false;
  }
  return true;
}

/** `document.body` is null until the parser reaches <body>, which a key press at document_start can beat. */
function pageBody(): HTMLElement | null {
  return document.body;
}

function elementAtViewportCenter(): Element | null {
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;
  let element = document.elementFromPoint(x, y);
  while (element !== null) {
    const inner = shadowRootOf(element)?.elementFromPoint(x, y) ?? null;
    if (inner === null || inner === element) break;
    element = inner;
  }
  return element;
}

function visibleArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  const width = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const height = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  return width > 0 && height > 0 ? width * height : 0;
}
