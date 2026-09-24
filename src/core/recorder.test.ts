import { describe, expect, it } from 'vitest';
import type { KeyInput } from './keyEvent';
import { createRecorder, RECORD_PAUSE_MS } from './recorder';

function key(k: string, code: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { key: k, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, altGraph: false, ...mods };
}

const g = key('g', 'KeyG');
const i = key('i', 'KeyI');

describe('createRecorder', () => {
  it('records chords until a pause', () => {
    const recorder = createRecorder({ mode: 'key', isMac: false });
    expect(recorder.keyDown(g, false)).toEqual({
      state: { status: 'recording', keys: 'g' },
      consume: true,
      wait: RECORD_PAUSE_MS,
    });
    expect(recorder.keyDown(i, false).state).toEqual({ status: 'recording', keys: 'g i' });
    expect(recorder.timeout()).toEqual({ state: { status: 'done', keys: 'g i' }, consume: true, wait: null });
  });

  it('waits as long as it takes for the first key', () => {
    const recorder = createRecorder({ mode: 'key', isMac: false });
    expect(recorder.keyDown(key('Shift', 'ShiftLeft', { shiftKey: true }), false).wait).toBeNull();
    expect(recorder.keyDown(key('?', 'Slash', { shiftKey: true }), false).state).toEqual({
      status: 'recording',
      keys: '?',
    });
  });

  it('cancels on Esc and finishes on Enter, Tab or blur', () => {
    const escape = createRecorder({ mode: 'key', isMac: false });
    escape.keyDown(g, false);
    expect(escape.keyDown(key('Escape', 'Escape'), false)).toEqual({
      state: { status: 'cancelled' },
      consume: true,
      wait: null,
    });

    const enter = createRecorder({ mode: 'key', isMac: false });
    enter.keyDown(g, false);
    expect(enter.keyDown(key('Enter', 'Enter'), false)).toMatchObject({ state: { status: 'done', keys: 'g' }, consume: true });

    // Tab moves focus on as usual, so it isn't consumed.
    const tab = createRecorder({ mode: 'key', isMac: false });
    tab.keyDown(g, false);
    expect(tab.keyDown(key('Tab', 'Tab', { shiftKey: true }), false)).toMatchObject({
      state: { status: 'done', keys: 'g' },
      consume: false,
    });

    const blur = createRecorder({ mode: 'key', isMac: false });
    expect(blur.blur()).toMatchObject({ state: { status: 'done', keys: '' }, consume: false });
  });

  it('records Esc and Enter with modifiers', () => {
    const recorder = createRecorder({ mode: 'key', isMac: false });
    expect(recorder.keyDown(key('Escape', 'Escape', { shiftKey: true }), false).state).toEqual({
      status: 'recording',
      keys: 'shift+escape',
    });
    expect(recorder.keyDown(key('Enter', 'Enter', { ctrlKey: true }), false).state).toEqual({
      status: 'recording',
      keys: 'shift+escape mod+enter',
    });
  });

  it("records the platform's command key as mod", () => {
    const mac = createRecorder({ mode: 'key', isMac: true });
    expect(mac.keyDown(key('k', 'KeyK', { metaKey: true }), false).state).toMatchObject({ keys: 'mod+k' });
    expect(mac.keyDown(key('k', 'KeyK', { ctrlKey: true }), false).state).toMatchObject({ keys: 'mod+k ctrl+k' });

    const pc = createRecorder({ mode: 'key', isMac: false });
    expect(pc.keyDown(key('K', 'KeyK', { ctrlKey: true, shiftKey: true }), false).state).toMatchObject({
      keys: 'mod+shift+k',
    });
  });

  it('records physical keys in code mode', () => {
    const recorder = createRecorder({ mode: 'code', isMac: false });
    expect(recorder.keyDown(key('?', 'Slash', { shiftKey: true }), false).state).toEqual({
      status: 'recording',
      keys: 'shift+Slash',
    });
  });

  it('ignores auto-repeats and stops at four chords', () => {
    const recorder = createRecorder({ mode: 'key', isMac: false });
    recorder.keyDown(g, false);
    expect(recorder.keyDown(g, true).state).toEqual({ status: 'recording', keys: 'g' });
    recorder.keyDown(g, false);
    recorder.keyDown(g, false);
    expect(recorder.keyDown(i, false)).toMatchObject({ state: { status: 'done', keys: 'g g g i' }, wait: null });
    // Settled: later keys are left alone.
    expect(recorder.keyDown(g, false)).toMatchObject({ state: { status: 'done' }, consume: false });
  });
});
