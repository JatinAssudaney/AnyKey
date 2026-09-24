import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { hintLabels } from '../core/hintLabels';
import type { Mode } from './modes';
import { deepElementFromPoint, deepElements, flatParent } from './shadow';
import { CONTROLS, INTERACTIVE, isVisible } from './targets';
import { h } from './ui/h';
import { UI_HOST, type UiRoot } from './ui/root';

export interface HintsOptions {
  ctx: ContentScriptContext;
  ui: UiRoot;
  /** The characters labels are made of, the most comfortable first: the hintChars setting. */
  chars: string;
  /** Whether picking opens a link in a new tab, which the bar naming hint mode says. */
  newTab: boolean;
  pushMode: (mode: Mode) => void;
  popMode: (mode: Mode) => void;
  /** Runs on the element whose label was typed, once the hints are gone. */
  activate: (element: Element) => void;
  toast: (message: string) => void;
}

interface Hint {
  element: Element;
  label: string;
  marker: HTMLSpanElement;
}

/** Room the bar naming hint mode keeps from the viewport's edge, in px, as in the CSS. */
const BAR_EDGE = 16;

/**
 * Link hints (rules in docs/design.md, "Hints"): a label on everything in view that can be clicked or typed into.
 * Typing a label picks its element. Until then every key belongs to the hints, and the page gets none.
 */
export function openHints(options: HintsOptions): void {
  const { ctx } = options;
  const targets = hintTargets();
  if (targets.length === 0) {
    options.toast('No links or buttons in view.');
    return;
  }
  // Labels ignore case, so Shift and Caps Lock don't matter when typing them.
  const labels = hintLabels(targets.length, options.chars.toLowerCase());
  const hints = targets.flatMap((element, i): Hint[] => {
    const label = labels[i];
    return label === undefined ? [] : [{ element, label, marker: h('span', { class: 'ak-link-hint' }) }];
  });
  if (hints.length === 0) return;
  // Keys pick labels instead of running shortcuts until the hints close, so the mode says so while it lasts.
  const action = options.newTab ? 'open it in a new tab' : 'click it';
  const bar = h(
    'div',
    { class: 'ak-surface ak-link-hints-bar' },
    h('strong', {}, 'Hint mode: '),
    `type a label to ${action}, or press Esc to go back to your shortcuts.`,
  );

  let typed = '';
  let closed = false;
  let layer: HTMLElement | null = null;
  let frame: number | undefined;
  const listening = new AbortController();

  /** Leaves the key stack at once, so the next key goes where it would have gone without hints. */
  function close(): void {
    if (closed) return;
    closed = true;
    options.popMode(mode);
    listening.abort();
    if (frame !== undefined) cancelAnimationFrame(frame);
    layer?.remove();
  }

  function type(key: string): void {
    const char = key.toLowerCase();
    // Named keys such as Tab do nothing, and neither does a character that no label goes on with.
    if (Array.from(char).length !== 1) return;
    const matching = hints.filter((hint) => hint.label.startsWith(typed + char));
    const [first] = matching;
    if (first === undefined) return;
    if (matching.length === 1) {
      close();
      options.activate(first.element);
      return;
    }
    typed += char;
    render();
  }

  const mode: Mode = {
    keyDown(event) {
      // Browser shortcuts such as reloading still work; the page doesn't see them.
      if (event.ctrlKey || event.altKey || event.metaKey) return 'isolate';
      // Auto-repeats are the same press: holding F a little long must not type a label.
      if (event.repeat) return 'consume';
      if (event.key === 'Escape') close();
      else if (event.key === 'Backspace') {
        typed = Array.from(typed).slice(0, -1).join('');
        render();
      } else type(event.key);
      return 'consume';
    },
    pointer(event) {
      // A press anywhere closes the hints, and still reaches the page.
      if (event.type === 'pointerdown' || event.type === 'mousedown') close();
    },
  };

  /** Shows the hints that go on with what was typed, with the typed part set apart. */
  function render(): void {
    for (const { label, marker } of hints) {
      const shown = label.startsWith(typed);
      marker.hidden = !shown;
      if (shown) marker.replaceChildren(h('span', { class: 'ak-link-hint-typed' }, typed), label.slice(typed.length));
    }
  }

  /**
   * Puts each hint on its element's top left corner, moved in from the viewport's top and left edges. A hint whose
   * element left the view or the page hides.
   */
  function place(): void {
    frame = undefined;
    for (const { element, marker } of hints) {
      const box = element.isConnected ? boxInView(element) : null;
      marker.style.visibility = box === null ? 'hidden' : '';
      if (box === null) continue;
      marker.style.left = `${Math.round(Math.max(box.left, 0))}px`;
      marker.style.top = `${Math.round(Math.max(box.top, 0))}px`;
    }
    placeBar();
  }

  /**
   * Keeps the bar at the bottom of the viewport, or at the top while fewer labels would sit on it there. Labels draw
   * above the bar, so one on its text makes it hard to read.
   */
  function placeBar(): void {
    if (layer === null) return;
    const view = layer.getBoundingClientRect();
    const { left, right, height } = bar.getBoundingClientRect();
    const shown = hints.filter(({ marker }) => !marker.hidden && marker.style.visibility !== 'hidden');
    const labels = shown.map(({ marker }) => marker.getBoundingClientRect());
    const covered = (top: number): number =>
      labels.filter((box) => box.left < right && box.right > left && box.top < top + height && box.bottom > top).length;
    const atBottom = view.bottom - BAR_EDGE - height;
    const atTop = view.top + BAR_EDGE;
    bar.classList.toggle('ak-link-hints-bar-top', covered(atBottom) > covered(atTop));
  }

  function placeSoon(): void {
    frame ??= ctx.requestAnimationFrame(place);
  }

  options.pushMode(mode);
  const signal = listening.signal;
  // Hints follow their elements as the page or a part of it scrolls, and close with the extension.
  document.addEventListener('scroll', placeSoon, { capture: true, passive: true, signal });
  window.addEventListener('resize', placeSoon, { signal });
  window.addEventListener(
    'blur',
    (event) => {
      if (event.target === window) close();
    },
    { signal },
  );
  ctx.signal.addEventListener('abort', close, { signal });

  options.ui.container().then(
    (container) => {
      if (closed) return;
      const markers = hints.map(({ marker }) => marker);
      // Labels come after the bar, so they draw above it.
      layer = h('div', { class: 'ak-link-hints', popover: 'manual', 'aria-hidden': 'true' }, bar, ...markers);
      container.append(layer);
      render();
      // Shown before placing, since placing the bar measures it. Nothing paints in between.
      layer.showPopover();
      place();
    },
    (error: unknown) => {
      console.error('AnyKey: link hints failed to open.', error);
      close();
    },
  );
}

interface Target {
  element: Element;
  box: DOMRect;
}

/**
 * What gets a hint, in document order with shadow roots included: the interactive elements in view that aren't
 * disabled, and elements that only a pointer cursor marks as clickable, when nothing covers them.
 */
export function hintTargets(): Element[] {
  const targets: Target[] = [];
  for (const element of deepElements((element) => element.localName === UI_HOST)) {
    if (element === document.documentElement || element === document.body) continue;
    if (element.matches(INTERACTIVE) ? element.matches(':disabled') : !isPointerTarget(element)) continue;
    const box = boxInView(element);
    if (box !== null && isVisible(element) && isOnTop(element, box)) targets.push({ element, box });
  }
  return withoutRepeats(targets);
}

/**
 * An element marked as clickable only by its pointer cursor, as on sites that handle clicks in script: the
 * outermost element with that cursor, when it isn't inside a control. Only elements in view are checked, since
 * reading styles is slow.
 */
function isPointerTarget(element: Element): boolean {
  if (!overlapsView(element.getBoundingClientRect()) || getComputedStyle(element).cursor !== 'pointer') return false;
  const parent = flatParent(element);
  if (parent !== null && getComputedStyle(parent).cursor === 'pointer') return false;
  for (let ancestor = parent; ancestor !== null; ancestor = flatParent(ancestor)) {
    if (ancestor.matches(CONTROLS)) return false;
  }
  return true;
}

/** Where the element shows in the viewport: its first box in view (a link can wrap across lines). */
function boxInView(element: Element): DOMRect | null {
  const bounds = element.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return childBoxInView(element);
  if (!overlapsView(bounds)) return null;
  for (const box of element.getClientRects()) if (overlapsView(box)) return box;
  return null;
}

/** For an element with no box of its own, such as a link around a floated image, a child's box stands in. */
function childBoxInView(element: Element): DOMRect | null {
  for (const child of element.children) {
    for (const box of child.getClientRects()) if (overlapsView(box)) return box;
  }
  return null;
}

function overlapsView(box: DOMRect): boolean {
  const inView = box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
  return inView && box.width > 0 && box.height > 0;
}

/** Points of a box, as fractions of its width and height, where an element that isn't covered should show. */
const SAMPLES = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
] as const;

/** Whether the element itself (or something inside it) shows at the middle of its box in view, or around it. */
function isOnTop(element: Element, box: DOMRect): boolean {
  const left = Math.max(box.left, 0);
  const top = Math.max(box.top, 0);
  const width = Math.min(box.right, innerWidth) - left;
  const height = Math.min(box.bottom, innerHeight) - top;
  return SAMPLES.some(([x, y]) => isWithin(deepElementFromPoint(left + width * x, top + height * y), element));
}

function isWithin(node: Element | null, element: Element): boolean {
  for (let current = node; current !== null; current = flatParent(current)) {
    if (current === element) return true;
  }
  return false;
}

/**
 * Leaves out hints that would repeat others: a target inside another target with the same box takes that one's
 * hint (a link that fills a menu item), and an element that only its pointer cursor or tabindex marks as
 * clickable gets none when there are targets inside it (a wrapper around a button, a scrolling region of links).
 */
function withoutRepeats(targets: readonly Target[]): Element[] {
  const boxes = new Map(targets.map(({ element, box }) => [element, box]));
  const dropped = new Set<Element>();
  for (const { element, box } of targets) {
    let nearest = true;
    for (let ancestor = flatParent(element); ancestor !== null; ancestor = flatParent(ancestor)) {
      const outer = boxes.get(ancestor);
      if (outer === undefined) continue;
      if ((nearest && sameBox(outer, box)) || !ancestor.matches(CONTROLS)) dropped.add(ancestor);
      nearest = false;
    }
  }
  return targets.flatMap(({ element }) => (dropped.has(element) ? [] : [element]));
}

/** Boxes whose sides are all within a few pixels of each other. */
function sameBox(a: DOMRect, b: DOMRect): boolean {
  return [a.left - b.left, a.top - b.top, a.right - b.right, a.bottom - b.bottom].every((side) => Math.abs(side) <= 4);
}
