import { describe, expect, it } from 'vitest';
import { ActionSchema, LIMITS, ShortcutSchema, storedKeys } from './schema';

const base = {
  id: 'user:1',
  keys: 'g n',
  keyMode: 'key',
  action: { type: 'navigate', url: '/notifications' },
  scope: { type: 'site', match: '*://github.com/*' },
  label: 'Notifications',
  source: 'user',
  enabled: true,
};

describe('ShortcutSchema', () => {
  it('accepts a valid shortcut', () => {
    expect(ShortcutSchema.safeParse(base).success).toBe(true);
  });

  it('reports unparseable keys on the keys field', () => {
    const result = ShortcutSchema.safeParse({ ...base, keys: 'shift+/' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['keys']);
  });

  it('rejects invalid match patterns', () => {
    expect(ShortcutSchema.safeParse({ ...base, scope: { type: 'site', match: 'github.com' } }).success).toBe(false);
  });
});

describe('storedKeys', () => {
  it('returns the canonical notation', () => {
    expect(storedKeys('Cmd+K  g', 'key')).toEqual({ ok: true, keys: 'meta+k g' });
  });

  it('checks the length of the stored form, which can be longer than what was typed', () => {
    const keys = Array.from({ length: 4 }, () => 'cmd+shift+pgdn').join(' ');
    expect(keys.length).toBeLessThanOrEqual(LIMITS.keys);
    expect(storedKeys(keys, 'key')).toEqual({ ok: false, error: 'These keys are too long to save. Use fewer keys.' });
  });
});

describe('ActionSchema', () => {
  it('refuses URLs that could run script', () => {
    expect(ActionSchema.safeParse({ type: 'navigate', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'navigate', url: 'https://example.com' }).success).toBe(true);
  });

  it('rejects unknown action types', () => {
    expect(ActionSchema.safeParse({ type: 'script', code: 'alert(1)' }).success).toBe(false);
  });
});
