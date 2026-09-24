import { browser, type Browser } from 'wxt/browser';
import { BACKUP_KEY, BackupSchema, parseSync, type Backup, type SyncData } from '../core/docs';

// Reading storage. Every context reads; only the background writer (./writer.ts) writes.

export async function loadSync(): Promise<SyncData> {
  return parseSync(await browser.storage.sync.get(null));
}

/** The data saved before the last import or restore, or null when there is none. */
export async function loadBackup(): Promise<Backup | null> {
  const { [BACKUP_KEY]: raw } = await browser.storage.local.get(BACKUP_KEY);
  const parsed = BackupSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export interface Watcher {
  /** Reads storage again. Resolves once the callback has had the result, or a newer one. */
  refresh(): Promise<void>;
  stop(): void;
}

/** Calls `onData` with the sync data now and after every change to it, until stopped. */
export function watchSync(onData: (data: SyncData) => void): Watcher {
  return watch(browser.storage.sync, () => true, loadSync, onData);
}

/** Calls `onBackup` with the backup now and after every change to it, until stopped. */
export function watchBackup(onBackup: (backup: Backup | null) => void): Watcher {
  return watch(browser.storage.local, (changes) => BACKUP_KEY in changes, loadBackup, onBackup);
}

/** Every relevant change starts a fresh read, and an older read never overwrites a newer one. */
function watch<T>(
  area: Browser.storage.StorageArea,
  relevant: (changes: Record<string, unknown>) => boolean,
  load: () => Promise<T>,
  onData: (value: T) => void,
): Watcher {
  let started = 0;
  let delivered = 0;
  let stopped = false;

  async function refresh(): Promise<void> {
    const read = ++started;
    try {
      const value = await load();
      if (stopped || read < delivered) return;
      delivered = read;
      onData(value);
    } catch (error) {
      if (!stopped) console.error('AnyKey: storage could not be read.', error);
    }
  }
  const onChanged = (changes: Record<string, unknown>): void => {
    if (relevant(changes)) void refresh();
  };

  area.onChanged.addListener(onChanged);
  void refresh();
  return {
    refresh,
    stop() {
      stopped = true;
      try {
        area.onChanged.removeListener(onChanged);
      } catch {
        // A content script left behind by an extension reload can't reach the API, and its listener is dead anyway.
      }
    },
  };
}
