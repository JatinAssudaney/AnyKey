import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Shortcut } from '../core/schema';
import { createWriter, type Writer } from './writer';

const mine = (id: string, keys: string): Shortcut => ({
  id,
  keys,
  keyMode: 'key',
  action: { type: 'scroll', direction: 'down' },
  scope: { type: 'global' },
  label: 'Mine',
  source: 'user',
  enabled: true,
});

const syncItems = () => browser.storage.sync.get(null);

describe('createWriter', () => {
  let writer: Writer;

  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    writer = createWriter({ windowMs: 300, minIntervalMs: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves changes that arrive together in one write', async () => {
    const set = vi.spyOn(browser.storage.sync, 'set');
    const saves = Promise.all([
      writer.submit({ op: 'setSettings', settings: { scrollStep: 90 } }),
      writer.submit({ op: 'saveShortcut', shortcut: mine('user:1', 'n') }),
    ]);
    await vi.advanceTimersByTimeAsync(300);
    await saves;
    expect(set).toHaveBeenCalledTimes(1);
    expect(await syncItems()).toEqual({
      settings: { v: 1, scrollStep: 90 },
      global: { v: 1, shortcuts: [mine('user:1', 'n')], overrides: {} },
    });
  });

  it('spaces writes out', async () => {
    const set = vi.spyOn(browser.storage.sync, 'set');
    const first = writer.submit({ op: 'setSettings', settings: { scrollStep: 90 } });
    await vi.advanceTimersByTimeAsync(300);
    await first;
    const second = writer.submit({ op: 'setSettings', settings: { scrollStep: 100 } });
    await vi.advanceTimersByTimeAsync(300);
    expect(set).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(700);
    await second;
    expect(set).toHaveBeenCalledTimes(2);
  });

  it('rejects a change that fails on its own, and saves the rest', async () => {
    const bad = writer.submit({ op: 'setDefault', id: 'default:nope', enabled: false });
    const good = writer.submit({ op: 'setSettings', settings: { scrollStep: 90 } });
    const failed = expect(bad).rejects.toThrow(/no built-in/);
    await vi.advanceTimersByTimeAsync(300);
    await failed;
    await good;
    expect(await syncItems()).toEqual({ settings: { v: 1, scrollStep: 90 } });
  });

  it('writes nothing when nothing changed, and removes docs that became empty', async () => {
    await browser.storage.sync.set({ settings: { v: 1, scrollStep: 90 } });
    const set = vi.spyOn(browser.storage.sync, 'set');
    const same = writer.submit({ op: 'setSettings', settings: { scrollStep: 90 } });
    await vi.advanceTimersByTimeAsync(300);
    await same;
    expect(set).not.toHaveBeenCalled();

    const reset = writer.submit({ op: 'setSettings', settings: { scrollStep: 60 } });
    await vi.advanceTimersByTimeAsync(300);
    await reset;
    expect(await syncItems()).toEqual({});
  });

  it('backs up the data an import replaces, and a restore swaps it back', async () => {
    const original = { settings: { v: 1, scrollStep: 90 }, 'future:thing': { v: 1 } };
    await browser.storage.sync.set(original);
    const imported = writer.submit({ op: 'replaceAll', items: { settings: { v: 1, scrollStep: 200 } } });
    await vi.advanceTimersByTimeAsync(300);
    await imported;
    expect(await syncItems()).toEqual({ settings: { v: 1, scrollStep: 200 }, 'future:thing': { v: 1 } });
    const { backup } = await browser.storage.local.get('backup');
    expect(backup).toEqual({ savedAt: expect.any(Number) as number, items: original });

    const restored = writer.submit({ op: 'restoreBackup' });
    await vi.advanceTimersByTimeAsync(1000);
    await restored;
    expect(await syncItems()).toEqual(original);
    const { backup: swapped } = await browser.storage.local.get('backup');
    expect(swapped).toMatchObject({ items: { settings: { v: 1, scrollStep: 200 } } });
  });

  it('restores docs exactly as they were, even one from a newer version', async () => {
    const newer = { global: { v: 2, shortcuts: [], future: { kept: true } } };
    await browser.storage.sync.set(newer);
    const imported = writer.submit({ op: 'replaceAll', items: { settings: { v: 1, scrollStep: 200 } } });
    await vi.advanceTimersByTimeAsync(300);
    await imported;
    expect(await syncItems()).toEqual({ settings: { v: 1, scrollStep: 200 } });

    const restored = writer.submit({ op: 'restoreBackup' });
    await vi.advanceTimersByTimeAsync(1000);
    await restored;
    expect(await syncItems()).toEqual(newer);
  });

  it('keeps the previous backup when an import or restore fails to write', async () => {
    const backup = { savedAt: 1, items: { settings: { v: 1, scrollStep: 90 } } };
    await browser.storage.local.set({ backup });
    await browser.storage.sync.set({ settings: { v: 1, scrollStep: 200 } });
    vi.spyOn(browser.storage.sync, 'set').mockRejectedValue(new Error('IO error'));

    const restore = expect(writer.submit({ op: 'restoreBackup' })).rejects.toThrow(/IO error/);
    await vi.advanceTimersByTimeAsync(300);
    await restore;
    const items = { settings: { v: 1, scrollStep: 150 } };
    const imported = expect(writer.submit({ op: 'replaceAll', items })).rejects.toThrow(/IO error/);
    await vi.advanceTimersByTimeAsync(1000);
    await imported;
    expect(await browser.storage.local.get('backup')).toEqual({ backup });
    expect(await syncItems()).toEqual({ settings: { v: 1, scrollStep: 200 } });
  });

  it('leaves no backup when a first import fails to write, and keeps the new one when it half-writes', async () => {
    const set = vi.spyOn(browser.storage.sync, 'set').mockRejectedValueOnce(new Error('IO error'));
    const items = { settings: { v: 1, scrollStep: 150 } };
    const failed = expect(writer.submit({ op: 'replaceAll', items })).rejects.toThrow(/IO error/);
    await vi.advanceTimersByTimeAsync(300);
    await failed;
    expect(await browser.storage.local.get('backup')).toEqual({});

    // The settings are written, then removing the old site doc fails: the data before the import is the backup.
    const before = { settings: { v: 1, scrollStep: 90 }, 'site:a.example': { v: 1, disabled: true } };
    set.mockRestore();
    await browser.storage.sync.set(before);
    vi.spyOn(browser.storage.sync, 'remove').mockRejectedValueOnce(new Error('IO error'));
    const half = expect(writer.submit({ op: 'replaceAll', items })).rejects.toThrow(/IO error/);
    await vi.advanceTimersByTimeAsync(1000);
    await half;
    expect(await browser.storage.local.get('backup')).toEqual({ backup: { savedAt: expect.any(Number) as number, items: before } });
  });

  it('refuses to restore when there is no backup', async () => {
    const restore = expect(writer.submit({ op: 'restoreBackup' })).rejects.toThrow('There is no backup to restore.');
    await vi.advanceTimersByTimeAsync(300);
    await restore;
  });

  it('explains quota errors from the browser', async () => {
    vi.spyOn(browser.storage.sync, 'set').mockRejectedValue(
      new Error('MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded'),
    );
    const save = expect(writer.submit({ op: 'setSettings', settings: { scrollStep: 90 } })).rejects.toThrow(
      /Wait a minute/,
    );
    await vi.advanceTimersByTimeAsync(300);
    await save;
  });
});
