import { describe, expect, it } from 'vitest';
import { ActionSchema, ShortcutSchema } from './schema';

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

describe('ActionSchema', () => {
  it('refuses URLs that could run script', () => {
    expect(ActionSchema.safeParse({ type: 'navigate', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'navigate', url: 'https://example.com' }).success).toBe(true);
  });

  it('rejects unknown action types', () => {
    expect(ActionSchema.safeParse({ type: 'script', code: 'alert(1)' }).success).toBe(false);
  });
});
