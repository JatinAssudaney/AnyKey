import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { codeToken, isModifierOnly, keyToken, type KeyInput } from '../core/keyEvent';
import type { Shortcut } from '../core/schema';
import { compileBindings, createMatcher, type Matcher, type Step } from '../core/sequence';
import { isTypingContext } from './editable';
import type { Disposition, Mode } from './modes';
import type { UiRoot } from './ui/root';

export interface EngineOptions {
  ctx: ContentScriptContext;
  ui: UiRoot;
  isMac: boolean;
  sequenceTimeoutMs: () => number;
  /** Runs before a keydown reaches the shortcuts, which may then be replaced (they depend on the page's URL). */
  beforeMatch: () => void;
  run: (shortcut: Shortcut, repeat: boolean) => void;
}

export interface Engine {
  setShortcuts(shortcuts: readonly Shortcut[]): void;
  pushMode(mode: Mode): void;
  popMode(mode: Mode): void;
}

/**
 * The page-side key engine (rules in docs/design.md, "Key engine"). It listens on `window` in the capture phase
 * from document_start, so it sees every key before page scripts do, and it stops a key only when a shortcut or
 * AnyKey's own UI takes it.
 */
export function startEngine(options: EngineOptions): Engine {
  const { ctx, ui, isMac } = options;
  let matcher: Matcher<Shortcut> = createMatcher([], options.sequenceTimeoutMs());
  /** What the matcher was built from, as JSON. */
  let built = '';
  let timer: number | undefined;
  const modes: Mode[] = [];
  /** Where the first keydown of each key still held went, by physical key. Its keyup goes the same way. */
  const routes = new Map<string, Disposition | 'pass'>();

  function stop(event: KeyboardEvent, disposition: Disposition): void {
    if (disposition === 'consume') event.preventDefault();
    event.stopImmediatePropagation();
  }

  function route(event: KeyboardEvent, disposition: Disposition | 'pass'): void {
    if (disposition !== 'pass') stop(event, disposition);
    if (!event.repeat && event.code !== '') routes.set(event.code, disposition);
  }

  function stopTimer(): void {
    clearTimeout(timer);
    timer = undefined;
  }

  function apply(step: Step<Shortcut>): void {
    stopTimer();
    if (step.wait !== null) {
      timer = ctx.setTimeout(() => {
        timer = undefined;
        apply(matcher.flush(performance.now()));
      }, step.wait);
    }
    for (const shortcut of step.fire) {
      try {
        options.run(shortcut, step.repeat);
      } catch (error) {
        console.error(`AnyKey: "${shortcut.label}" failed.`, error);
      }
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    // After an extension update or reload, this script's APIs are dead: let every key through.
    if (ctx.isInvalid || !event.isTrusted) return;
    const input = keyInput(event);
    // Chrome's autofill sends keydowns without a key.
    if (input === null) return;

    const mode = modes.at(-1);
    if (mode !== undefined) {
      route(event, mode.keyDown(event, keyToken(input, isMac)));
      return;
    }
    if (ui.owns(event.target)) {
      route(event, 'isolate');
      return;
    }
    // keyCode 229 is the only IME signal some platforms send on the keydown that starts a composition.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (event.isComposing || event.keyCode === 229 || isModifierOnly(input)) {
      route(event, 'pass');
      return;
    }

    options.beforeMatch();
    const step = matcher.keyDown(
      {
        key: keyToken(input, isMac),
        code: codeToken(input),
        editable: isTypingContext(event),
        repeat: event.repeat,
        held: routes.get(input.code) === 'consume',
      },
      performance.now(),
    );
    route(event, step.consume ? 'consume' : 'pass');
    apply(step);
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (ctx.isInvalid || !event.isTrusted) return;
    // A keyup follows its keydown even when focus has moved since: Shift pressed on the way to "?" goes down to the
    // page, so the page must see it come up while the cheatsheet has focus.
    const disposition = routes.get(event.code) ?? (ui.owns(event.target) ? 'isolate' : 'pass');
    routes.delete(event.code);
    if (disposition !== 'pass') stop(event, disposition);
  }

  /** Keys typed and focus moving inside AnyKey's UI stay private: page hotkeys and focus traps never see them. */
  function isolateUiEvent(event: Event): void {
    if (ctx.isInvalid) return;
    if (ui.owns(event.target) || (event.type === 'keypress' && modes.length > 0)) event.stopImmediatePropagation();
  }

  /** Text typed or pasted into AnyKey's fields stays private too: a page's input or paste handlers never see it. */
  function isolateUiInput(event: Event): void {
    if (ctx.isInvalid || !ui.owns(event.target)) return;
    event.stopImmediatePropagation();
    modes.at(-1)?.uiInput?.();
  }

  function onPointer(event: MouseEvent): void {
    if (ctx.isInvalid || !event.isTrusted) return;
    modes.at(-1)?.pointer?.(event);
  }

  function onWindowBlur(event: Event): void {
    if (event.target !== window) return;
    // Keyups may never arrive while the window is in the background.
    routes.clear();
    matcher.reset();
    stopTimer();
  }

  const capture = { capture: true };
  ctx.addEventListener(window, 'keydown', onKeyDown, capture);
  ctx.addEventListener(window, 'keyup', onKeyUp, capture);
  for (const type of ['keypress', 'focusin', 'focusout', 'focus', 'blur'] as const) {
    ctx.addEventListener(window, type, isolateUiEvent, capture);
  }
  for (const type of UI_INPUT_EVENTS) ctx.addEventListener(window, type, isolateUiInput, capture);
  // Registered now, before page scripts run, so a mode such as the picker sees presses and clicks first.
  for (const type of POINTER_EVENTS) ctx.addEventListener(window, type, onPointer, capture);
  ctx.addEventListener(window, 'blur', onWindowBlur, capture);

  return {
    setShortcuts(shortcuts) {
      const timeoutMs = options.sequenceTimeoutMs();
      // Most storage changes and page navigations leave the shortcuts as they were: a sequence in progress goes on.
      const next = JSON.stringify([timeoutMs, shortcuts]);
      if (next === built) return;
      built = next;
      stopTimer();
      matcher = createMatcher(compileBindings(shortcuts, isMac), timeoutMs);
    },
    pushMode(mode) {
      stopTimer();
      matcher.reset();
      modes.push(mode);
    },
    popMode(mode) {
      const index = modes.lastIndexOf(mode);
      if (index !== -1) modes.splice(index, 1);
    },
  };
}

const UI_INPUT_EVENTS = [
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'paste',
  'copy',
  'cut',
] as const;

const POINTER_EVENTS = [
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointercancel',
  'mousedown',
  'mouseup',
  'mousemove',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
] as const;

/** The fields of a keydown that shortcuts depend on, or null for the keydowns without a key that autofill sends. */
export function keyInput(event: KeyboardEvent): KeyInput | null {
  const key: unknown = event.key;
  const code: unknown = event.code;
  if (typeof key !== 'string' || typeof code !== 'string') return null;
  return {
    key,
    code,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    altGraph: event.getModifierState('AltGraph'),
  };
}
