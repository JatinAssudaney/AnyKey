import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS } from './defaults';
import { canonicalKeys } from './keys';
import { SettingsSchema, ShortcutSchema } from './schema';

describe('defaults', () => {
  it('are valid shortcuts with unique ids', () => {
    for (const shortcut of DEFAULT_SHORTCUTS) expect(ShortcutSchema.parse(shortcut)).toEqual(shortcut);
    const ids = DEFAULT_SHORTCUTS.map((shortcut) => shortcut.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bind the documented keys, in canonical form, each once', () => {
    const keys = DEFAULT_SHORTCUTS.map((shortcut) => shortcut.keys);
    expect(keys).toEqual(['j', 'k', 'd', 'u', 'g g', 'G', 'f', 'F', 'H', 'L', 'J', 'K', 'x', '?']);
    for (const shortcut of DEFAULT_SHORTCUTS) expect(canonicalKeys(shortcut.keys, shortcut.keyMode)).toBe(shortcut.keys);
  });

  it('have valid settings', () => {
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});
