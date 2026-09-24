import { browser } from 'wxt/browser';
import { BACKUP_KEY, parseSync, type Backup, type SyncData } from '../core/docs';
import type { Mutation } from '../core/messages';
import { errorMessage } from '../messaging';
import { applyMutation, restoreItems, type MutationResult } from './mutations';
import { loadBackup } from './read';

/** Changes that arrive within this window are saved together. */
const WINDOW_MS = 300;
/** The least time between two saves. A save makes at most two writes (a set and a remove): 120 a minute at most. */
const MIN_INTERVAL_MS = 1000;

export interface Writer {
  /** Resolves once the change is saved, or rejects with a message for the user. */
  submit(mutation: Mutation): Promise<void>;
}

interface Entry {
  mutation: Mutation;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * The only code that writes chrome.storage.sync (rules in docs/design.md, "Storage"). It runs in the background,
 * so a change is saved even when the page that sent it closes at once. Each save reads the stored data fresh,
 * applies the queued mutations in order, and writes only the docs that changed.
 */
export function createWriter(options: { windowMs?: number; minIntervalMs?: number } = {}): Writer {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const minIntervalMs = options.minIntervalMs ?? MIN_INTERVAL_MS;
  let queue: Entry[] = [];
  let busy = false;
  let lastWriteAt = -Infinity;

  function schedule(): void {
    if (busy || queue.length === 0) return;
    busy = true;
    const delay = Math.max(windowMs, lastWriteAt + minIntervalMs - Date.now());
    setTimeout(() => {
      const batch = queue;
      queue = [];
      void save(batch).then((wrote) => {
        if (wrote) lastWriteAt = Date.now();
        busy = false;
        schedule();
      });
    }, delay);
  }

  return {
    submit(mutation) {
      return new Promise((resolve, reject) => {
        queue.push({ mutation, resolve, reject });
        schedule();
      });
    },
  };
}

/** Saves one batch and settles each entry. Resolves to whether it wrote to sync storage. Never rejects. */
async function save(batch: readonly Entry[]): Promise<boolean> {
  let before: SyncData;
  try {
    before = parseSync(await browser.storage.sync.get(null));
  } catch (error) {
    for (const entry of batch) entry.reject(new Error(saveError(error)));
    return false;
  }

  let data = before;
  const touched = new Set<string>();
  const applied: Entry[] = [];
  // undefined until read. An import or restore replaces it with the data as it stood just before.
  let backup: Backup | null | undefined;
  let backupChanged = false;
  for (const entry of batch) {
    const { mutation } = entry;
    let result: MutationResult;
    if (mutation.op === 'restoreBackup') {
      try {
        backup = backup === undefined ? await loadBackup() : backup;
      } catch (error) {
        entry.reject(new Error(saveError(error)));
        continue;
      }
      if (backup === null) {
        entry.reject(new Error('There is no backup to restore.'));
        continue;
      }
      result = restoreItems(data, backup.items);
    } else {
      result = applyMutation(data, mutation);
    }
    if (!result.ok) {
      entry.reject(new Error(result.error));
      continue;
    }
    if (mutation.op === 'replaceAll' || mutation.op === 'restoreBackup') {
      // Restoring swaps: the data it replaces becomes the backup, so a second restore undoes the first.
      backup = { savedAt: Date.now(), items: data.items };
      backupChanged = true;
    }
    data = result.data;
    for (const key of result.touched) touched.add(key);
    applied.push(entry);
  }

  const set: [string, unknown][] = [];
  const remove: string[] = [];
  for (const key of touched) {
    if (Object.hasOwn(data.items, key)) {
      if (JSON.stringify(data.items[key]) !== JSON.stringify(before.items[key])) set.push([key, data.items[key]]);
    } else if (Object.hasOwn(before.items, key)) {
      remove.push(key);
    }
  }

  let wrote = false;
  // Set while a new backup is saved and sync storage is still unchanged. A failure then puts the previous backup
  // back: nothing was replaced, so it is still the one to keep.
  let undoBackup: (() => Promise<void>) | null = null;
  try {
    // The backup goes first, so the data an import or restore replaces is kept before it goes.
    if (backupChanged && backup) undoBackup = await saveBackup(backup);
    if (set.length > 0) {
      wrote = true;
      await browser.storage.sync.set(Object.fromEntries(set));
      undoBackup = null;
    }
    if (remove.length > 0) {
      wrote = true;
      await browser.storage.sync.remove(remove);
    }
  } catch (error) {
    if (undoBackup !== null) await undoBackup();
    for (const entry of applied) entry.reject(new Error(saveError(error)));
    return wrote;
  }
  for (const entry of applied) entry.resolve();
  return wrote;
}

/** Saves a new backup, and returns what puts the previous one back. */
async function saveBackup(backup: Backup): Promise<() => Promise<void>> {
  const { [BACKUP_KEY]: previous } = await browser.storage.local.get(BACKUP_KEY);
  await browser.storage.local.set({ [BACKUP_KEY]: backup });
  return async () => {
    try {
      if (previous === undefined) await browser.storage.local.remove(BACKUP_KEY);
      else await browser.storage.local.set({ [BACKUP_KEY]: previous });
    } catch (error) {
      console.error('AnyKey: the previous backup could not be put back.', error);
    }
  };
}

function saveError(error: unknown): string {
  const message = errorMessage(error);
  if (message.includes('MAX_WRITE_OPERATIONS')) {
    return 'The browser limits how often synced settings can change. Wait a minute, then try again.';
  }
  if (/quota/i.test(message)) return 'AnyKey has run out of synced storage. Delete some shortcuts, then try again.';
  return `AnyKey couldn't save the change: ${message}`;
}
