import { eventChord, isModifierOnly, type KeyInput } from './keyEvent';
import { chordText, MAX_SEQUENCE_LENGTH, type Chord } from './keys';
import type { KeyMode } from './schema';

/** How long the recorder waits after a key before it takes the shortcut as finished. */
export const RECORD_PAUSE_MS = 1000;

export type RecorderState =
  | { status: 'recording'; keys: string }
  | { status: 'done'; keys: string }
  | { status: 'cancelled' };

export interface RecorderStep {
  state: RecorderState;
  /** Cancel the keydown's default action. False for Tab, which moves focus on as usual. */
  consume: boolean;
  /** Milliseconds until `timeout()` must run, or null to stop any timer. */
  wait: number | null;
}

export interface Recorder {
  keyDown(input: KeyInput, repeat: boolean): RecorderStep;
  /** The pause after the last key ran out. */
  timeout(): RecorderStep;
  /** Focus left the recorder. */
  blur(): RecorderStep;
}

/**
 * Records a shortcut from key presses (rules in docs/design.md, "Options page"): up to four chords, finished by a
 * pause, Enter, Tab or focus leaving, and cancelled by Esc. `keys` is "" when nothing was pressed. Shared by the
 * options page and the in-page picker, so both record the same notation.
 */
export function createRecorder(options: { mode: KeyMode; isMac: boolean; pauseMs?: number }): Recorder {
  const pauseMs = options.pauseMs ?? RECORD_PAUSE_MS;
  const chords: string[] = [];
  let state: RecorderState = { status: 'recording', keys: '' };

  function step(next: RecorderState, consume: boolean): RecorderStep {
    state = next;
    // The first key may take as long as it likes; after that, a pause finishes the shortcut.
    const wait = next.status === 'recording' && chords.length > 0 ? pauseMs : null;
    return { state, consume, wait };
  }
  const finish = (consume: boolean): RecorderStep => step({ status: 'done', keys: chords.join(' ') }, consume);
  const settled = (): RecorderStep => ({ state, consume: false, wait: null });

  return {
    keyDown(input, repeat) {
      if (state.status !== 'recording') return settled();
      const bare = !input.ctrlKey && !input.altKey && !input.metaKey && !input.shiftKey;
      if (input.key === 'Tab') return finish(false);
      if (bare && input.key === 'Escape') return step({ status: 'cancelled' }, true);
      if (bare && input.key === 'Enter') return finish(true);
      // A held key or a modifier on its way to a chord restarts the pause.
      if (repeat || isModifierOnly(input)) return step(state, true);
      const chord = eventChord(input, options.mode, options.isMac);
      if (chord === null) return step(state, true);
      chords.push(chordText(portable(chord, options.isMac)));
      if (chords.length === MAX_SEQUENCE_LENGTH) return finish(true);
      return step({ status: 'recording', keys: chords.join(' ') }, true);
    },
    timeout: () => (state.status === 'recording' ? finish(true) : settled()),
    blur: () => (state.status === 'recording' ? finish(false) : settled()),
  };
}

/** Records the platform's command key (⌘ on macOS, Ctrl elsewhere) as `mod`, so it works on every synced computer. */
function portable(chord: Chord, isMac: boolean): Chord {
  if (isMac && chord.meta) return { ...chord, meta: false, mod: true };
  if (!isMac && chord.ctrl) return { ...chord, ctrl: false, mod: true };
  return chord;
}
