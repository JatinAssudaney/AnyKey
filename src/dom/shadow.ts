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
