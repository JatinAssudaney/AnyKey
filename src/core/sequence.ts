import { sequenceTokens } from './keys';
import type { KeyMode, Shortcut } from './schema';

/** A shortcut compiled for matching: its keys as match tokens, with `mod` resolved for the platform. */
export interface Binding<T> {
  mode: KeyMode;
  tokens: readonly string[];
  allowInInputs: boolean;
  /** Fires again while its key is held (single-chord scroll shortcuts only). */
  repeatable: boolean;
  value: T;
}

/** One keydown, reduced to what matching needs. */
export interface Press {
  /** Key-mode token from `keyToken`, or null. */
  key: string | null;
  /** Code-mode token from `codeToken`, or null. */
  code: string | null;
  /** Focus is in a text field, so only `allowInInputs` shortcuts may match. */
  editable: boolean;
  /** An auto-repeat keydown from a held key. */
  repeat: boolean;
  /** The first keydown of this held key was consumed. Only read for repeats. */
  held: boolean;
}

export interface Step<T> {
  /** Stop this keydown from reaching the page. */
  consume: boolean;
  /** Shortcuts to run now, in order. */
  fire: T[];
  /** The shortcuts fired because a key is held. */
  repeat: boolean;
  /** Milliseconds until `flush()` must run, or null to cancel any pending flush. */
  wait: number | null;
}

export interface Matcher<T> {
  keyDown(press: Press, now: number): Step<T>;
  /** Runs when `wait` elapses: fires the pending shortcut. */
  flush(now: number): Step<T>;
  /** Drops any partial sequence without firing it. */
  reset(): void;
}

export function compileBindings(shortcuts: readonly Shortcut[], isMac: boolean): Binding<Shortcut>[] {
  return shortcuts.flatMap((shortcut) => {
    const tokens = sequenceTokens(shortcut.keys, shortcut.keyMode, isMac);
    if (tokens === null) return [];
    return [
      {
        mode: shortcut.keyMode,
        tokens,
        allowInInputs: shortcut.allowInInputs ?? false,
        repeatable: shortcut.action.type === 'scroll' && tokens.length === 1,
        value: shortcut,
      },
    ];
  });
}

/**
 * The key-sequence state machine (rules in docs/design.md, "Key engine"):
 * - A key is consumed only when it completes a shortcut, or continues a sequence whose earlier keys were consumed.
 * - A pure prefix passes through to the page, so a site's own "g i" still works next to AnyKey's "g g".
 * - A key that is both a full shortcut and a prefix is consumed and waits: it fires after `timeoutMs`, or when the
 *   next key breaks the sequence, and the keys after it are then replayed as a fresh start.
 * - Repeats never advance a sequence. Held single-chord scroll shortcuts fire on every repeat.
 * Bindings earlier in the list win ties, and a key-mode binding beats a code-mode one on the same press.
 */
export function createMatcher<T>(bindings: readonly Binding<T>[], timeoutMs: number): Matcher<T> {
  let buffer: Press[] = [];
  let pending: { value: T; length: number } | null = null;
  let sequenceConsumed = false;
  let lastAt = 0;

  function clear(): void {
    buffer = [];
    pending = null;
    sequenceConsumed = false;
  }

  function accepts(binding: Binding<T>, presses: readonly Press[]): boolean {
    if (binding.tokens.length < presses.length) return false;
    return presses.every(
      (press, i) =>
        (binding.allowInInputs || !press.editable) &&
        (binding.mode === 'key' ? press.key : press.code) === binding.tokens[i],
    );
  }

  function lookup(presses: readonly Press[]): { exact: Binding<T> | undefined; longer: boolean } {
    let exact: Binding<T> | undefined;
    let longer = false;
    for (const binding of bindings) {
      if (!accepts(binding, presses)) continue;
      if (binding.tokens.length > presses.length) longer = true;
      else if (exact === undefined || (exact.mode === 'code' && binding.mode === 'key')) exact = binding;
    }
    return { exact, longer };
  }

  /** Feeds one press and returns whether it is consumed. */
  function feed(press: Press, fired: T[]): boolean {
    const presses = [...buffer, press];
    const { exact, longer } = lookup(presses);
    if (longer) {
      buffer = presses;
      if (exact !== undefined) {
        pending = { value: exact.value, length: presses.length };
        sequenceConsumed = true;
      }
      return sequenceConsumed;
    }
    if (exact !== undefined) {
      fired.push(exact.value);
      clear();
      return true;
    }
    if (buffer.length === 0) return false;
    // The press breaks the sequence: run the longest full match, then replay what came after it.
    const replay = buffer.slice(pending?.length ?? 1);
    if (pending !== null) fired.push(pending.value);
    clear();
    for (const earlier of replay) feed(earlier, fired);
    return feed(press, fired);
  }

  function expire(fired: T[]): void {
    const replay = pending === null ? [] : buffer.slice(pending.length);
    if (pending !== null) fired.push(pending.value);
    clear();
    for (const earlier of replay) feed(earlier, fired);
  }

  function step(consume: boolean, fire: T[], repeat: boolean, now: number): Step<T> {
    return { consume, fire, repeat, wait: pending === null ? null : Math.max(0, lastAt + timeoutMs - now) };
  }

  return {
    keyDown(press, now) {
      if (press.repeat) {
        // Repeats of keys the page received stay with the page.
        if (!press.held) return step(false, [], true, now);
        const single = buffer.length === 0 ? lookup([press]) : undefined;
        const fire = single?.exact?.repeatable === true ? [single.exact.value] : [];
        return step(true, fire, true, now);
      }
      const fired: T[] = [];
      if (buffer.length > 0 && now - lastAt >= timeoutMs) {
        // A late timer: settle the expired sequence before this press.
        if (pending === null) clear();
        else expire(fired);
      }
      lastAt = now;
      const consume = feed(press, fired);
      return step(consume, fired, false, now);
    },
    flush(now) {
      const fired: T[] = [];
      expire(fired);
      lastAt = now;
      return step(false, fired, false, now);
    },
    reset: clear,
  };
}
