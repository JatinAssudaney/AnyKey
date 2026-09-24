import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { SyncData } from '../core/docs';
import { loadBackup, watchBackup, watchSync } from './read';

describe('watchSync', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('delivers the stored data, then every change, until stopped', async () => {
    await browser.storage.sync.set({ settings: { v: 1, scrollStep: 90 } });
    const seen: SyncData[] = [];
    const watcher = watchSync((data) => seen.push(data));
    await vi.waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]?.state.settings).toEqual({ scrollStep: 90 });

    await browser.storage.sync.set({ settings: { v: 1, scrollStep: 120 } });
    await vi.waitFor(() => {
      expect(seen.at(-1)?.state.settings).toEqual({ scrollStep: 120 });
    });

    watcher.stop();
    const count = seen.length;
    await browser.storage.sync.set({ settings: { v: 1, scrollStep: 150 } });
    await watcher.refresh();
    expect(seen).toHaveLength(count);
  });

  it('resolves refresh once the fresh data is delivered', async () => {
    const seen: SyncData[] = [];
    const watcher = watchSync((data) => seen.push(data));
    await browser.storage.sync.set({ settings: { v: 1, scrollStep: 90 } });
    await watcher.refresh();
    expect(seen.at(-1)?.state.settings).toEqual({ scrollStep: 90 });
    watcher.stop();
  });
});

describe('backups', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('reads a valid backup and ignores anything else', async () => {
    expect(await loadBackup()).toBeNull();
    await browser.storage.local.set({ backup: { savedAt: 'yesterday', items: {} } });
    expect(await loadBackup()).toBeNull();
    await browser.storage.local.set({ backup: { savedAt: 5, items: { settings: { v: 1 } } } });
    expect(await loadBackup()).toEqual({ savedAt: 5, items: { settings: { v: 1 } } });
  });

  it('follows changes to the backup', async () => {
    const seen: unknown[] = [];
    const watcher = watchBackup((backup) => seen.push(backup));
    await vi.waitFor(() => {
      expect(seen).toEqual([null]);
    });
    await browser.storage.local.set({ backup: { savedAt: 5, items: {} } });
    await vi.waitFor(() => {
      expect(seen).toEqual([null, { savedAt: 5, items: {} }]);
    });
    watcher.stop();
  });
});
