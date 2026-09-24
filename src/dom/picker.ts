import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { PickedShortcut } from '../core/messages';
import type { Shortcut } from '../core/schema';
import { truncate } from '../core/text';
import { linkOf } from './click';
import { isEditable } from './editable';
import type { Disposition, Mode } from './modes';
import { describeTarget } from './selectorCandidates';
import { deepActiveElement, deepElementFromPoint, deepElements, flatParent, shadowRootOf } from './shadow';
import { INTERACTIVE, isVisible, textOf } from './targets';
import { createPickerOverlay, type PickerOverlay } from './ui/pickerOverlay';
import { openPickerPanel, type PickerPanel } from './ui/pickerPanel';
import { UI_HOST, type UiRoot } from './ui/root';

export interface PickerOptions {
  ctx: ContentScriptContext;
  ui: UiRoot;
  isMac: boolean;
  pushMode: (mode: Mode) => void;
  popMode: (mode: Mode) => void;
  /** The shortcuts that apply to the page now, for the new shortcut's conflict check. */
  pageShortcuts: () => readonly Shortcut[];
  /** Saves the new shortcut. Resolves to an error message, or null once it is saved. */
  save: (shortcut: PickedShortcut) => Promise<string | null>;
  saved: (shortcut: PickedShortcut) => void;
  /** The picker closed without saving. */
  cancelled: () => void;
}

export interface Picker {
  /** Starts picking. Does nothing while the picker is already open. */
  start(): void;
}

/** How many ancestors up hovering looks for the button or link an element sits in. */
const PROMOTE_DEPTH = 6;

/**
 * The element picker (rules in docs/design.md, "Picker"). While it is open the page gets no presses or clicks, and
 * the element under the pointer, or reached with Tab and the arrow keys, is outlined. Picking one opens the panel
 * that makes it a shortcut.
 */
export function createPicker(options: PickerOptions): Picker {
  const { ctx, ui } = options;
  let phase: 'idle' | 'picking' | 'editing' = 'idle';
  let current: Element | null = null;
  let description = '';
  /** Elements ↑ walked out of, so ↓ walks back into them. */
  let trail: Element[] = [];
  /** Where the pointer moved since the last frame, or null when it didn't. */
  let pointer: { x: number; y: number } | null = null;
  let overlay: PickerOverlay | null = null;
  let panel: PickerPanel | null = null;
  let frame: number | undefined;

  const mode: Mode = {
    keyDown(event) {
      if (phase === 'editing') return panel?.keyDown(event) ?? 'consume';
      return pickingKey(event);
    },
    pointer(event) {
      // AnyKey's own banner and panel work as usual.
      if (ui.owns(event.target)) return;
      // Hovering still reaches the page, so a menu that opens on hover can be picked from.
      if (event.type === 'pointermove' || event.type === 'mousemove') {
        if (phase === 'picking') pointer = { x: event.clientX, y: event.clientY };
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (phase === 'picking' && event.type === 'click' && event.button === 0) {
        const element = elementAt(event.clientX, event.clientY);
        if (element !== null) pick(element);
      }
    },
    uiInput() {
      panel?.update();
    },
  };

  function pickingKey(event: KeyboardEvent): Disposition {
    // Browser shortcuts such as reloading still work; the page doesn't see them.
    if (event.ctrlKey || event.metaKey || event.altKey) return 'isolate';
    if (event.repeat && (event.key === 'Escape' || event.key === 'Enter')) return 'consume';
    switch (event.key) {
      case 'Escape':
        cancel();
        break;
      case 'Enter':
        if (current !== null) pick(current);
        else overlay?.announce('Point at an element, or press Tab to move to one.');
        break;
      case 'ArrowUp':
        walkUp();
        break;
      case 'ArrowDown':
        walkDown();
        break;
      case 'Tab':
        move(event.shiftKey ? -1 : 1);
        break;
    }
    return 'consume';
  }

  /** The element under a point, moved up to the button or link it sits in. Null over AnyKey's UI or the page itself. */
  function elementAt(x: number, y: number): Element | null {
    const top = document.elementFromPoint(x, y);
    if (top === null || ui.owns(top)) return null;
    const element = deepElementFromPoint(x, y);
    if (element === null || isPage(element)) return null;
    for (let ancestor: Element | null = element, i = 0; ancestor !== null && i <= PROMOTE_DEPTH; i++) {
      if (isPage(ancestor)) break;
      if (ancestor.matches(INTERACTIVE)) return ancestor;
      ancestor = flatParent(ancestor);
    }
    return element;
  }

  function setCurrent(element: Element, announce: boolean): void {
    current = element;
    description = describeElement(element);
    if (announce) overlay?.announce(description);
  }

  function walkUp(): void {
    const parent = current === null ? null : flatParent(current);
    if (current === null || parent === null || isPage(parent)) return;
    trail.push(current);
    setCurrent(parent, true);
  }

  function walkDown(): void {
    if (current === null) return;
    const child = trail.pop() ?? [...(shadowRootOf(current) ?? current).children].find(isVisible);
    if (child !== undefined) setCurrent(child, true);
  }

  /** Tab and Shift+Tab: the next or previous interactive element, starting from what is on screen. */
  function move(direction: 1 | -1): void {
    const stops = deepElements((element) => element.localName === UI_HOST).filter(
      (element) => element.matches(INTERACTIVE) && isVisible(element),
    );
    const index = current === null ? -1 : stops.indexOf(current);
    const next =
      index === -1
        ? direction === 1
          ? (stops.find(onScreen) ?? stops[0])
          : (stops.findLast(onScreen) ?? stops.at(-1))
        : stops[(index + direction + stops.length) % stops.length];
    if (next === undefined) return;
    trail = [];
    setCurrent(next, true);
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function pick(element: Element): void {
    phase = 'editing';
    setCurrent(element, false);
    overlay?.showBanner(false);
    const text = textOf(element);
    openPickerPanel({
      root: ui,
      ctx,
      isMac: options.isMac,
      host: location.hostname,
      description,
      target: describeTarget(element),
      kind: isEditable(element) ? 'focus' : 'click',
      isLink: linkOf(element) !== null,
      name: text === '' ? kindOf(element).toLowerCase() : truncate(text, 60),
      pageShortcuts: options.pageShortcuts(),
      save: options.save,
      onClose(result) {
        panel = null;
        if (result.type === 'again') {
          phase = 'picking';
          overlay?.showBanner(true);
          return;
        }
        stop();
        if (result.type === 'saved') options.saved(result.shortcut);
        else options.cancelled();
      },
    }).then(
      (opened) => {
        panel = opened;
        overlay?.raise();
      },
      (error: unknown) => {
        console.error('AnyKey: the picker panel failed to open.', error);
        cancel();
      },
    );
  }

  function loop(): void {
    frame = ctx.requestAnimationFrame(loop);
    if (phase === 'picking' && pointer !== null) {
      const element = elementAt(pointer.x, pointer.y);
      pointer = null;
      if (element !== null && element !== current) {
        trail = [];
        setCurrent(element, false);
      }
    }
    overlay?.place(current, description);
  }

  function stop(): void {
    phase = 'idle';
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    overlay?.remove();
    overlay = null;
    current = null;
    trail = [];
    pointer = null;
    options.popMode(mode);
  }

  function cancel(): void {
    if (phase === 'idle') return;
    stop();
    options.cancelled();
  }

  return {
    start() {
      if (phase !== 'idle') return;
      phase = 'picking';
      options.pushMode(mode);
      // Someone who tabbed to an element before opening the popup starts on it.
      if (!ui.owns(document.activeElement)) {
        const focused = deepActiveElement();
        if (focused !== null && !isPage(focused)) setCurrent(focused, false);
      }
      createPickerOverlay(ui, cancel).then(
        (created) => {
          if (phase === 'idle') {
            created.remove();
            return;
          }
          overlay = created;
          loop();
        },
        (error: unknown) => {
          console.error('AnyKey: the picker failed to open.', error);
          cancel();
        },
      );
    },
  };
}

function isPage(element: Element): boolean {
  return element === document.documentElement || element === document.body;
}

function onScreen(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
}

/** What was picked, in words: `Button "Star"`, `Link "Releases"`, `div element`. */
export function describeElement(element: Element): string {
  const text = textOf(element);
  const kind = kindOf(element);
  return text === '' ? kind : `${kind} "${truncate(text, 40)}"`;
}

function kindOf(element: Element): string {
  const role = element.getAttribute('role');
  if (element.matches('a[href]') || role === 'link') return 'Link';
  if (element.matches('button, input[type="button"], input[type="submit"], input[type="reset"]') || role === 'button') {
    return 'Button';
  }
  if (element.matches('input[type="checkbox"]') || role === 'checkbox' || role === 'switch') return 'Checkbox';
  if (element.matches('input[type="radio"]') || role === 'radio') return 'Radio button';
  if (element.matches('select') || role === 'listbox') return 'List';
  if (isEditable(element)) return 'Text field';
  if (role === 'tab') return 'Tab';
  if (role === 'menuitem') return 'Menu item';
  if (element.matches('img, svg')) return 'Image';
  return `${element.localName} element`;
}
