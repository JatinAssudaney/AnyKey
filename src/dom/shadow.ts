import { browser } from 'wxt/browser';

/** An element's shadow root, open or closed. Content scripts can reach closed roots through `chrome.dom`. */
export function shadowRootOf(element: Element): ShadowRoot | null {
  if (element.shadowRoot !== null) return element.shadowRoot;
  return element instanceof HTMLElement ? browser.dom.openOrClosedShadowRoot(element) : null;
}

/** The element's parent in the rendered tree: its assigned slot, its parent element, or its shadow host. */
export function flatParent(element: Element): Element | null {
  if (element.assignedSlot !== null) return element.assignedSlot;
  if (element.parentElement !== null) return element.parentElement;
  const root = element.parentNode;
  return root instanceof ShadowRoot ? root.host : null;
}

/** The focused element, looking inside open and closed shadow roots. */
export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active !== null) {
    const inner = shadowRootOf(active)?.activeElement ?? null;
    if (inner === null) break;
    active = inner;
  }
  return active;
}

/** The element at a point of the viewport, looking inside open and closed shadow roots. */
export function deepElementFromPoint(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  while (element !== null) {
    const inner = shadowRootOf(element)?.elementFromPoint(x, y) ?? null;
    if (inner === null || inner === element) break;
    element = inner;
  }
  return element;
}

/**
 * Every element in the document and in the shadow roots inside it, each shadow root's elements right after its
 * host. Closed roots are looked for only on custom elements, which is where pages put them: asking the browser
 * about every element would be slow on large pages. `skip` leaves an element and everything inside it out.
 */
export function deepElements(skip: (element: Element) => boolean): Element[] {
  const elements: Element[] = [];
  const filter = (node: Node): number =>
    node instanceof Element && skip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
  function visit(root: Document | ShadowRoot): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, filter);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (!(node instanceof Element)) continue;
      elements.push(node);
      const shadow = node.shadowRoot ?? (node.localName.includes('-') ? shadowRootOf(node) : null);
      if (shadow !== null) visit(shadow);
    }
  }
  visit(document);
  return elements;
}
