import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS } from './defaults';
import type { Shortcut } from './schema';
import { compileBindings, createMatcher, type Binding, type Press } from './sequence';

const TIMEOUT = 800;

function bind(keys: string, value: string, extra: Partial<Binding<string>> = {}): Binding<string> {
  return { mode: 'key', tokens: keys.split(' '), allowInInputs: false, repeatable: false, value, ...extra };
}

function press(key: string, extra: Partial<Press> = {}): Press {
  return { key, code: null, editable: false, repeat: false, held: false, ...extra };
}

describe('createMatcher', () => {
  it('consumes and fires a single-key shortcut', () => {
    const m = createMatcher([bind('j', 'down')], TIMEOUT);
    expect(m.keyDown(press('j'), 0)).toEqual({ consume: true, fire: ['down'], repeat: false, wait: null });
  });

  it('lets unmatched keys through', () => {
    const m = createMatcher([bind('j', 'down')], TIMEOUT);
    expect(m.keyDown(press('z'), 0)).toMatchObject({ consume: false, fire: [] });
  });

  it('passes a pure prefix through and consumes the key that completes the sequence', () => {
    const m = createMatcher([bind('g g', 'top')], TIMEOUT);
    expect(m.keyDown(press('g'), 0)).toMatchObject({ consume: false, fire: [], wait: null });
    expect(m.keyDown(press('g'), 100)).toMatchObject({ consume: true, fire: ['top'] });
  });

  it("leaves a site's own sequence alone when the next key doesn't continue AnyKey's", () => {
    const m = createMatcher([bind('g g', 'top')], TIMEOUT);
    m.keyDown(press('g'), 0);
    expect(m.keyDown(press('i'), 100)).toMatchObject({ consume: false, fire: [] });
  });

  it('replays the key that breaks a prefix as a fresh start', () => {
    const m = createMatcher([bind('g g', 'top'), bind('j', 'down')], TIMEOUT);
    m.keyDown(press('g'), 0);
    expect(m.keyDown(press('j'), 100)).toMatchObject({ consume: true, fire: ['down'] });
  });

  it('forgets a prefix after the timeout', () => {
    const m = createMatcher([bind('g g', 'top')], TIMEOUT);
    m.keyDown(press('g'), 0);
    expect(m.keyDown(press('g'), TIMEOUT + 1)).toMatchObject({ consume: false, fire: [] });
    expect(m.keyDown(press('g'), TIMEOUT + 50)).toMatchObject({ consume: true, fire: ['top'] });
  });

  describe('a key that is both a shortcut and a prefix', () => {
    const bindings = [bind('g', 'go'), bind('g i', 'issues'), bind('x', 'close')];

    it('is consumed and waits for the timeout', () => {
      const m = createMatcher(bindings, TIMEOUT);
      expect(m.keyDown(press('g'), 0)).toEqual({ consume: true, fire: [], repeat: false, wait: TIMEOUT });
      expect(m.flush(TIMEOUT)).toMatchObject({ fire: ['go'], wait: null });
    });

    it('gives way to the longer shortcut', () => {
      const m = createMatcher(bindings, TIMEOUT);
      m.keyDown(press('g'), 0);
      expect(m.keyDown(press('i'), 100)).toMatchObject({ consume: true, fire: ['issues'], wait: null });
    });

    it('fires when the next key breaks the sequence, and that key is replayed', () => {
      const m = createMatcher(bindings, TIMEOUT);
      m.keyDown(press('g'), 0);
      expect(m.keyDown(press('x'), 100)).toMatchObject({ consume: true, fire: ['go', 'close'] });
    });

    it('fires before an unrelated key, which still reaches the page', () => {
      const m = createMatcher(bindings, TIMEOUT);
      m.keyDown(press('g'), 0);
      expect(m.keyDown(press('z'), 100)).toMatchObject({ consume: false, fire: ['go'] });
    });

    it('fires first when its timer ran late', () => {
      const m = createMatcher(bindings, TIMEOUT);
      m.keyDown(press('g'), 0);
      expect(m.keyDown(press('x'), 5000)).toMatchObject({ fire: ['go', 'close'] });
    });

    it('is dropped by reset', () => {
      const m = createMatcher(bindings, TIMEOUT);
      m.keyDown(press('g'), 0);
      m.reset();
      expect(m.flush(TIMEOUT)).toMatchObject({ fire: [] });
    });
  });

  it('consumes later prefix keys of a sequence that already consumed a key, and replays them on a break', () => {
    const m = createMatcher([bind('a', 'A'), bind('a b c', 'ABC'), bind('b', 'B')], TIMEOUT);
    expect(m.keyDown(press('a'), 0)).toMatchObject({ consume: true, fire: [] });
    expect(m.keyDown(press('b'), 50)).toMatchObject({ consume: true, fire: [] });
    expect(m.keyDown(press('d'), 100)).toMatchObject({ consume: false, fire: ['A', 'B'] });
  });

  describe('key repeat', () => {
    it('never advances a sequence', () => {
      const m = createMatcher([bind('g g', 'top')], TIMEOUT);
      m.keyDown(press('g'), 0);
      expect(m.keyDown(press('g', { repeat: true }), 30)).toMatchObject({ consume: false, fire: [], repeat: true });
      expect(m.keyDown(press('g'), 100)).toMatchObject({ consume: true, fire: ['top'] });
    });

    it('fires held single-chord scroll shortcuts', () => {
      const m = createMatcher([bind('j', 'down', { repeatable: true })], TIMEOUT);
      m.keyDown(press('j'), 0);
      expect(m.keyDown(press('j', { repeat: true, held: true }), 30)).toEqual({
        consume: true,
        fire: ['down'],
        repeat: true,
        wait: null,
      });
    });

    it('swallows repeats of other consumed keys without firing them', () => {
      const m = createMatcher([bind('x', 'close')], TIMEOUT);
      m.keyDown(press('x'), 0);
      expect(m.keyDown(press('x', { repeat: true, held: true }), 30)).toMatchObject({ consume: true, fire: [] });
    });

    it('keeps the pending timer running', () => {
      const m = createMatcher([bind('g', 'go'), bind('g i', 'issues')], TIMEOUT);
      m.keyDown(press('g'), 0);
      expect(m.keyDown(press('g', { repeat: true, held: true }), 300)).toMatchObject({ fire: [], wait: 500 });
    });
  });

  it('only lets allowInInputs shortcuts fire while typing', () => {
    const m = createMatcher([bind('j', 'down'), bind('ctrl+k', 'palette', { allowInInputs: true })], TIMEOUT);
    expect(m.keyDown(press('j', { editable: true }), 0)).toMatchObject({ consume: false, fire: [] });
    expect(m.keyDown(press('ctrl+k', { editable: true }), 10)).toMatchObject({ consume: true, fire: ['palette'] });
  });

  it('forgets a prefix typed before focus moved into a text field', () => {
    const m = createMatcher([bind('g g', 'top')], TIMEOUT);
    m.keyDown(press('g'), 0);
    expect(m.keyDown(press('g', { editable: true }), 50)).toMatchObject({ consume: false, fire: [] });
  });

  it('prefers a key-mode shortcut over a code-mode one on the same press', () => {
    const m = createMatcher(
      [bind('KeyK', 'physical', { mode: 'code' }), bind('k', 'character'), bind('k', 'second')],
      TIMEOUT,
    );
    expect(m.keyDown(press('k', { code: 'KeyK' }), 0)).toMatchObject({ fire: ['character'] });
  });

  it('matches code-mode shortcuts by physical key', () => {
    const m = createMatcher([bind('alt+KeyK', 'physical', { mode: 'code' })], TIMEOUT);
    expect(m.keyDown(press('alt+k', { code: 'alt+KeyK' }), 0)).toMatchObject({ consume: true, fire: ['physical'] });
  });
});

describe('compileBindings', () => {
  it('marks only single-chord scroll shortcuts as repeatable', () => {
    const bindings = compileBindings(DEFAULT_SHORTCUTS, false);
    const repeatable = bindings.filter((b) => b.repeatable).map((b) => b.value.id);
    expect(repeatable).toEqual([
      'default:scroll-down',
      'default:scroll-up',
      'default:scroll-half-down',
      'default:scroll-half-up',
      'default:scroll-bottom',
    ]);
  });

  it('drops shortcuts whose keys do not parse', () => {
    const broken = DEFAULT_SHORTCUTS.slice(0, 1).map((shortcut): Shortcut => ({ ...shortcut, keys: 'shift+/' }));
    expect(compileBindings(broken, false)).toEqual([]);
  });
});
