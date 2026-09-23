import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { codeToken, isModifierOnly, keyToken, type KeyInput } from '../core/keyEvent';
import type { Shortcut } from '../core/schema';
import { compileBindings, createMatcher, type Matcher, type Step } from '../core/sequence';
import { isTypingContext } from './editable';
import type { Mode } from './modes';
import type { UiRoot } from './ui/root';

export interface EngineOptions {
  ctx: ContentScriptContext;
  ui: UiRoot;
  isMac: boolean;
  sequenceTimeoutMs: () => number;
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
  let timer: number | undefined;
  const modes: Mode[] = [];
  /** Physical keys whose keydown was consumed. Their keyups are swallowed too. */
  const held = new Set<string>();

  function consume(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'keydown' && event.code !== '') held.add(event.code);
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
      if (mode.keyDown(event, keyToken(input, isMac)) === 'consume') consume(event);
      else event.stopImmediatePropagation();
      return;
    }
    if (ui.owns(event.target)) {
      event.stopImmediatePropagation();
      return;
    }
    // keyCode 229 is the only IME signal some platforms send on the keydown that starts a composition.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (event.isComposing || event.keyCode === 229 || isModifierOnly(input)) return;

    const step = matcher.keyDown(
      {
        key: keyToken(input, isMac),
        code: codeToken(input),
        editable: isTypingContext(event),
        repeat: event.repeat,
        held: held.has(input.code),
      },
      performance.now(),
    );
    if (step.consume) consume(event);
    apply(step);
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (ctx.isInvalid || !event.isTrusted) return;
    if (held.delete(event.code)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (modes.length > 0 || ui.owns(event.target)) {
      event.stopImmediatePropagation();
    }
  }

  /** Keys typed and focus moving inside AnyKey's UI stay private: page hotkeys and focus traps never see them. */
  function isolateUiEvent(event: Event): void {
    if (ctx.isInvalid) return;
    if (ui.owns(event.target) || (event.type === 'keypress' && modes.length > 0)) event.stopImmediatePropagation();
  }

  function onWindowBlur(event: Event): void {
    if (event.target !== window) return;
    // Keyups may never arrive while the window is in the background.
    held.clear();
    matcher.reset();
    stopTimer();
  }

  const capture = { capture: true };
  ctx.addEventListener(window, 'keydown', onKeyDown, capture);
  ctx.addEventListener(window, 'keyup', onKeyUp, capture);
  for (const type of ['keypress', 'focusin', 'focusout', 'focus', 'blur'] as const) {
    ctx.addEventListener(window, type, isolateUiEvent, capture);
  }
  ctx.addEventListener(window, 'blur', onWindowBlur, capture);

  return {
    setShortcuts(shortcuts) {
      stopTimer();
      matcher = createMatcher(compileBindings(shortcuts, isMac), options.sequenceTimeoutMs());
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

function keyInput(event: KeyboardEvent): KeyInput | null {
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
