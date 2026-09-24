import { LIMITS, type ElementTarget } from '../core/schema';
import { cssIdent, cssString, isGeneratedId, isStableClass, labelCondition } from '../core/selectorScore';
import { textOf } from './targets';

// Builds the target the picker saves for an element (rules in docs/design.md, "Picker"). Candidates come in order
// of how well they survive redesigns, each one checked in the live page to match the picked element and nothing
// else. The first becomes the selector and the next few the fallbacks.

/** Attributes sites add for their tests: the most stable hooks there are. */
const TEST_ATTRIBUTES = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy'];

/** Longer attribute values are more likely to hold something that changes, such as a query string. */
const MAX_VALUE = 200;

const MAX_FALLBACKS = 3;

/** Input types worth naming in a selector: `input[type="search"]` often finds a site's search box. */
const DISTINCT_INPUT_TYPES = new Set(['search', 'email', 'password', 'tel', 'url', 'number', 'date', 'file', 'range']);

export function describeTarget(element: Element): ElementTarget {
  // The shadow hosts between the document and the element, outermost first.
  const hosts: Element[] = [];
  for (let root = element.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) {
    hosts.unshift(root.host);
  }
  const prefix = hosts.map((host) => `${uniqueSelectors(host, 1)[0] ?? structuralPath(host)} >>> `).join('');
  const own = uniqueSelectors(element, 1 + MAX_FALLBACKS);
  if (own.length === 0) own.push(structuralPath(element));
  const [selector = '', ...fallbacks] = own.map((candidate) => prefix + candidate).filter(fits);

  const target: ElementTarget = { selector: selector === '' ? prefix + element.localName : selector };
  if (fallbacks.length > 0) target.fallbacks = fallbacks;
  const text = textOf(element);
  if (text !== '' && text.length <= LIMITS.label) target.text = text;
  if (/^[a-z][a-z\d-]*$/.test(element.localName) && element.localName.length <= 32) target.tag = element.localName;
  return target;
}

function fits(selector: string): boolean {
  return selector.length <= LIMITS.selector;
}

/** Up to `max` selectors that match only `element` within its own document or shadow root, best first. */
function uniqueSelectors(element: Element, max: number): string[] {
  const root = scopeOf(element);
  const unique: string[] = [];
  const rest: string[] = [];
  for (const candidate of candidates(element)) {
    if (unique.length === max) return unique;
    if (unique.includes(candidate)) continue;
    if (matchesOnly(root, candidate, element)) unique.push(candidate);
    else rest.push(candidate);
  }
  // Candidates that match more than the element can still work below an ancestor that is unique itself.
  const anchor = anchorOf(element, root);
  if (anchor !== null) {
    for (const candidate of rest) {
      if (unique.length === max) return unique;
      const scoped = `${anchor} ${candidate}`;
      if (matchesOnly(root, scoped, element)) unique.push(scoped);
    }
  }
  if (unique.length < max) {
    const path = structuralPath(element);
    if (!unique.includes(path) && matchesOnly(root, path, element)) unique.push(path);
  }
  return unique;
}

/** Selectors that may find the element, most stable first. */
function candidates(element: Element): string[] {
  const tag = cssIdent(element.localName);
  const list: string[] = [];
  const attribute = (name: string): string | null => {
    const value = element.getAttribute(name)?.trim() ?? '';
    return value === '' || value.length > MAX_VALUE ? null : value;
  };

  for (const name of TEST_ATTRIBUTES) {
    const value = attribute(name);
    if (value !== null) list.push(`[${name}=${cssString(value)}]`);
  }
  if (element.id !== '' && !isGeneratedId(element.id)) list.push(`#${cssIdent(element.id)}`);
  for (const name of ['aria-label', 'title', 'placeholder']) {
    const value = attribute(name);
    const condition = value === null ? null : labelCondition(name, value);
    if (condition !== null) list.push(tag + condition);
  }
  const name = attribute('name');
  if (name !== null && !isGeneratedId(name)) list.push(`${tag}[name=${cssString(name)}]`);
  const href = element.localName === 'a' ? attribute('href') : null;
  if (href !== null && !href.startsWith('#') && !/^javascript:/i.test(href)) list.push(`a[href=${cssString(href)}]`);
  const type = element.localName === 'input' ? attribute('type')?.toLowerCase() : undefined;
  if (type !== undefined && DISTINCT_INPUT_TYPES.has(type)) list.push(`input[type=${cssString(type)}]`);
  const role = attribute('role');
  if (role !== null && /^[a-z]+$/.test(role)) list.push(`${tag}[role=${cssString(role)}]`);

  const classes = [...element.classList].filter(isStableClass).slice(0, 4).map(cssIdent);
  for (const name of classes) list.push(`${tag}.${name}`);
  for (const [i, first] of classes.entries()) {
    for (const second of classes.slice(i + 1)) list.push(`${tag}.${first}.${second}`);
  }
  return list;
}

/** The nearest ancestor, in the same document or shadow root, with a test attribute or id that is unique. */
function anchorOf(element: Element, root: Document | ShadowRoot): string | null {
  for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
    const anchor = ownAnchor(ancestor, root);
    if (anchor !== null) return anchor;
  }
  return null;
}

function ownAnchor(element: Element, root: Document | ShadowRoot): string | null {
  const anchors = TEST_ATTRIBUTES.flatMap((name) => {
    const value = element.getAttribute(name);
    return value === null || value === '' || value.length > MAX_VALUE ? [] : [`[${name}=${cssString(value)}]`];
  });
  if (element.id !== '' && !isGeneratedId(element.id)) anchors.push(`#${cssIdent(element.id)}`);
  return anchors.find((anchor) => matchesOnly(root, anchor, element)) ?? null;
}

/**
 * A chain of child steps (`div:nth-of-type(2) > button`) up from the element, ending at the first ancestor with a
 * unique anchor, or as soon as the chain is unique. It breaks when the page's structure changes, so it comes last.
 */
function structuralPath(element: Element): string {
  const root = scopeOf(element);
  const steps: string[] = [];
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    if (current !== element) {
      const anchor = ownAnchor(current, root);
      if (anchor !== null) return [anchor, ...steps].join(' > ');
    }
    steps.unshift(step(current));
    const path = steps.join(' > ');
    if (!fits(path)) return steps.slice(1).join(' > ');
    if (matchesOnly(root, path, element)) return path;
  }
  return steps.join(' > ');
}

/** The element among its siblings: its tag, with its position among siblings of the same tag when it has any. */
function step(element: Element): string {
  const tag = cssIdent(element.localName);
  const siblings = element.parentElement?.children ?? element.parentNode?.childNodes ?? [];
  const same = [...siblings].filter((sibling) => sibling instanceof Element && sibling.localName === element.localName);
  return same.length <= 1 ? tag : `${tag}:nth-of-type(${same.indexOf(element) + 1})`;
}

function scopeOf(element: Element): Document | ShadowRoot {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root : document;
}

function matchesOnly(root: Document | ShadowRoot, selector: string, element: Element): boolean {
  try {
    const found = root.querySelectorAll(selector);
    return found.length === 1 && found[0] === element;
  } catch {
    return false;
  }
}
