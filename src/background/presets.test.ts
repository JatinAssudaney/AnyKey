import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Preset } from '../core/presets';
import { loadPresets } from '../storage/read';
import { installPresets, type PresetSource } from './presets';

const tube: Preset = {
  schemaVersion: 1,
  id: 'tube',
  name: 'Tube',
  version: 1,
  matches: ['*://tube.example/*'],
  reserved: [{ keys: 'k', label: 'Play or pause', yield: true }],
  shortcuts: [],
};

const source = (...presets: unknown[]): PresetSource => ({ load: () => Promise.resolve(presets) });

describe('installPresets', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('installs the bundled presets', async () => {
    await installPresets();
    expect((await loadPresets()).map((preset) => preset.id)).toEqual(['github', 'youtube', 'reddit']);
  });

  it('keeps the newest version of each preset, and leaves out any that fail their checks', async () => {
    const newer = { ...tube, version: 2, name: 'Tube 2' };
    await installPresets([source(tube, { ...tube, id: 'Bad id' }), source(newer, { ...tube, version: 1 })]);
    expect(await loadPresets()).toEqual([newer]);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('writes only when the presets changed, since every open tab resolves its shortcuts again', async () => {
    await installPresets([source(tube)]);
    const set = vi.spyOn(browser.storage.local, 'set');
    await installPresets([source(tube)]);
    expect(set).not.toHaveBeenCalled();
    await installPresets([source({ ...tube, version: 2 })]);
    expect(set).toHaveBeenCalledOnce();
  });
});
