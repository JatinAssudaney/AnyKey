import type { ElementTarget } from '../core/schema';
import { normalizeText, sameText } from '../core/text';
import { deepElements, shadowRootOf } from './shadow';
import { UI_HOST } from './ui/root';

/** Elements people click, pick or type into, apart from those a tabindex alone makes focusable. */
export const CONTROLS = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="treeitem"]',
  '[contenteditable]:not([contenteditable="false"])',
  '[onclick]',
].join(', ');

/** Elements people click, pick or type into: what the picker moves between and the text match looks through. */
export const INTERACTIVE = `${CONTROLS}, [tabindex]:not([tabindex="-1"])`;

/** Separates the steps of a selector that enter shadow roots: "reddit-search-large >>> input". */
const SHADOW_STEP = /\s*>>>\s*/;

/**
 * Every element a target selector matches, where each " >>> " steps into the shadow roots (open or closed) of the
 * elements matched so far. An invalid selector matches nothing.
 */
export function queryAll(selector: string): Element[] {
  let roots: (Document | ShadowRoot)[] = [document];
  const steps = selector.split(SHADOW_STEP);
  for (const [i, step] of steps.entries()) {
    const found: Element[] = [];
    try {
      for (const root of roots) found.push(...root.querySelectorAll(step));
    } catch {
      return [];
    }
    if (i === steps.length - 1) return found;
    // AnyKey's own UI is never a target.
    roots = found.flatMap((host) => {
      const shadow = host.localName === UI_HOST ? null : shadowRootOf(host);
      return shadow === null ? [] : [shadow];
    });
  }
  return [];
}

/** Whether the element is rendered: not hidden by display, visibility or content-visibility on it or an ancestor. */
export function isVisible(element: Element): boolean {
  return element.checkVisibility({ visibilityProperty: true });
}

/**
 * The element a shortcut acts on, found when its keys are pressed (rules in docs/design.md, "Picker"): the
 * selector, then the fallbacks, then the text among interactive elements (or elements of `tag`). A visible match
 * wins over a hidden one found earlier, so a hidden copy of a button doesn't hide the real one.
 */
export function findTarget(target: ElementTarget): Element | null {
  let hidden: Element | null = null;
  for (const selector of [target.selector, ...(target.fallbacks ?? [])]) {
    for (const element of queryAll(selector)) {
      if (isVisible(element)) return element;
      hidden ??= element;
    }
  }
  if (target.text !== undefined) {
    const { text } = target;
    const wanted = target.tag ?? INTERACTIVE;
    for (const element of deepElements((element) => element.localName === UI_HOST)) {
      if (!element.matches(wanted) || !sameText(textOf(element), text)) continue;
      if (isVisible(element)) return element;
      hidden ??= element;
    }
  }
  return hidden;
}

const BUTTON_INPUTS = new Set(['button', 'submit', 'reset']);

/**
 * The name an element shows or announces: its aria-label, its text, or failing those its title, placeholder,
 * button value or image alt text. Whitespace is collapsed.
 */
export function textOf(element: Element): string {
  const label = normalizeText(element.getAttribute('aria-label') ?? '');
  if (label !== '') return label;
  const text = normalizeText(element.textContent);
  if (text !== '') return text;
  const value = element instanceof HTMLInputElement && BUTTON_INPUTS.has(element.type) ? element.value : '';
  const alt = element.querySelector('img[alt]')?.getAttribute('alt') ?? '';
  for (const candidate of [element.getAttribute('title'), element.getAttribute('placeholder'), value, alt]) {
    const normalized = normalizeText(candidate ?? '');
    if (normalized !== '') return normalized;
  }
  return '';
}
