import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Backup, SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { sendToBackground } from '@/messaging';
import { applyMutation } from '@/storage/mutations';
import { watchBackup, watchSync, type Watcher } from '@/storage/read';

export interface SaveStatus {
  /** For the polite status region: "Saving…", then "Saved." */
  progress: string;
  /** For the alert region: why the last change failed. */
  error: string;
}

export interface SyncStore {
  /** Null until storage has loaded. Includes changes still being saved. */
  data: SyncData | null;
  backup: Backup | null;
  status: SaveStatus;
  /** Sends a change to the background writer. Resolves to an error message, or null once the change is saved. */
  mutate: (mutation: Mutation) => Promise<string | null>;
}

interface Pending {
  mutation: Mutation;
}

/**
 * The options page's view of storage. A change shows at once (applied locally with the writer's own reducers) and
 * stays applied until storage has been read again after the background answered, so nothing flickers back.
 */
export function useSync(): SyncStore {
  const [stored, setStored] = useState<SyncData | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [pending, setPending] = useState<readonly Pending[]>([]);
  const [status, setStatus] = useState<SaveStatus>({ progress: '', error: '' });
  const syncWatcher = useRef<Watcher | null>(null);
  const saving = useRef(0);

  useEffect(() => {
    const sync = watchSync(setStored);
    const backups = watchBackup(setBackup);
    syncWatcher.current = sync;
    return () => {
      sync.stop();
      backups.stop();
      syncWatcher.current = null;
    };
  }, []);

  const data = useMemo(() => {
    if (stored === null) return null;
    return pending.reduce((current, { mutation }) => {
      const result = applyMutation(current, mutation);
      return result.ok ? result.data : current;
    }, stored);
  }, [stored, pending]);

  const mutate = useCallback(async (mutation: Mutation): Promise<string | null> => {
    const entry: Pending = { mutation };
    setPending((list) => [...list, entry]);
    saving.current++;
    setStatus({ progress: 'Saving…', error: '' });

    const response = await sendToBackground({ type: 'mutate', mutation });
    // Mutations are idempotent, so the change may show twice over for a moment, but never not at all.
    await syncWatcher.current?.refresh();
    setPending((list) => list.filter((item) => item !== entry));
    saving.current--;
    if (!response.ok) {
      setStatus({ progress: '', error: response.error });
      return response.error;
    }
    if (saving.current === 0) setStatus((current) => ({ progress: 'Saved.', error: current.error }));
    return null;
  }, []);

  return { data, backup, status, mutate };
}
