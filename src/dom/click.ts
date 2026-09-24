import { deepActiveElement, flatParent } from './shadow';

/**
 * Clicks an element the way a mouse would: pointer and mouse events at its center, then a click, which also runs
 * the element's default action (following a link, toggling a checkbox, submitting a form). Menus that open on
 * pointerdown or mousedown open too. `modifier` holds Ctrl, or Cmd on macOS, which asks most sites for a new tab.
 */
export function clickElement(element: Element, options: { modifier: boolean; isMac: boolean }): void {
  const box = element.getBoundingClientRect();
  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    detail: 1,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
    ctrlKey: options.modifier && !options.isMac,
    metaKey: options.modifier && options.isMac,
  };
  const pointer: PointerEventInit = { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  element.dispatchEvent(new PointerEvent('pointerover', pointer));
  element.dispatchEvent(new MouseEvent('mouseover', init));
  element.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, buttons: 1 }));
  element.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }));
  element.dispatchEvent(new PointerEvent('pointerup', pointer));
  element.dispatchEvent(new MouseEvent('mouseup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

/** The link an element is or sits inside, in the rendered tree. */
export function linkOf(element: Element): HTMLAnchorElement | null {
  for (let current: Element | null = element; current !== null; current = flatParent(current)) {
    if (current instanceof HTMLAnchorElement && current.hasAttribute('href')) return current;
  }
  return null;
}

const FOCUSABLE = 'input:not([type="hidden"]), textarea, select, [contenteditable]:not([contenteditable="false"]), button, a[href], [tabindex]';

/**
 * Focuses an element, or the first focusable element inside it, with the caret at the end of any text. Returns
 * false when nothing took focus.
 */
export function focusElement(element: Element): boolean {
  const target = element.matches(FOCUSABLE) ? element : (element.querySelector(FOCUSABLE) ?? element);
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) return false;
  target.focus();
  if (deepActiveElement() !== target) return false;
  caretToEnd(target);
  return true;
}

function caretToEnd(element: Element): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    try {
      const end = element.value.length;
      element.setSelectionRange(end, end);
    } catch {
      // Inputs such as type="email" and type="number" have no caret position to set.
    }
    return;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
