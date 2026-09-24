import { useId, useRef, useState, type ChangeEvent } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { focusAfterRender } from '@/components/focus';
import { card, errorText, hintText, secondaryButton, sectionHeading } from '@/components/styles';
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  ExportFileSchema,
  itemBytes,
  parseSync,
  SYNC_QUOTA,
  type Backup,
  type ExportFile,
  type SyncData,
} from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { docName, problemMessage } from '@/storage/mutations';

interface DataSectionProps {
  data: SyncData;
  backup: Backup | null;
  mutate: (mutation: Mutation) => Promise<string | null>;
}

/** An import file that passed the checks, and what it holds. */
interface ImportPreview {
  file: ExportFile;
  data: SyncData;
}

/** Real exports are a few kilobytes; sync storage holds 100 KB at most. */
const MAX_IMPORT_BYTES = 1_000_000;

export function DataSection({ data, backup, mutate }: DataSectionProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const repairList = useRef<HTMLUListElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const [importError, setImportError] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [repairing, setRepairing] = useState<string | null>(null);
  const send = (mutation: Mutation): void => {
    void mutate(mutation);
  };

  async function onFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Choosing the same file again must still fire a change.
    event.target.value = '';
    if (file === undefined) return;
    const result = await readImport(file);
    if (typeof result === 'string') {
      setImportError(result);
    } else {
      setImportError('');
      setPreview(result);
    }
  }

  return (
    <section aria-labelledby="data-heading" className={card}>
      <h2 id="data-heading" className={sectionHeading}>
        Your data
      </h2>

      {data.problems.size > 0 && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <h3 className="text-sm font-semibold">Needs attention</h3>
          <ul ref={repairList} className="mt-2 space-y-2 text-sm">
            {[...data.problems].map(([key, problem]) => (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2">
                <span>{problemMessage(key, problem)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setRepairing(key);
                  }}
                  className={secondaryButton}
                >
                  Repair<span className="sr-only"> {docName(key)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={hintText}>
        Your shortcuts and settings sync to every computer where you're signed in to the browser. Export them to keep a
        copy or move them elsewhere.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          ref={exportButton}
          type="button"
          onClick={() => {
            downloadExport(data);
          }}
          className={secondaryButton}
        >
          Export to a file
        </button>
        <button
          type="button"
          onClick={() => {
            fileInput.current?.click();
          }}
          className={secondaryButton}
        >
          Import from a file…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label="Settings file to import"
          tabIndex={-1}
          hidden
          onChange={(event) => void onFile(event)}
        />
      </div>
      {importError !== '' && (
        <p role="alert" className={errorText}>
          {importError}
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold">Backup</h3>
      {backup === null ? (
        <p className={hintText}>No backup yet. Importing saves your settings as they were first.</p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm">Saved {formatTime(backup.savedAt)}, before your last import or restore.</p>
          <button
            type="button"
            onClick={() => {
              setRestoring(true);
            }}
            className={secondaryButton}
          >
            Restore backup
          </button>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">Storage</h3>
      <StorageMeters data={data} />

      {preview !== null && (
        <ConfirmDialog
          title="Replace your settings?"
          confirmLabel="Replace my settings"
          onConfirm={() => {
            send({ op: 'replaceAll', items: preview.file.items });
          }}
          onClose={() => {
            setPreview(null);
          }}
        >
          <ImportSummary preview={preview} />
          <p>Your current settings are saved as a backup first, so you can restore them from this page.</p>
        </ConfirmDialog>
      )}
      {restoring && backup !== null && (
        <ConfirmDialog
          title="Restore the backup?"
          confirmLabel="Restore backup"
          onConfirm={() => {
            send({ op: 'restoreBackup' });
          }}
          onClose={() => {
            setRestoring(false);
          }}
        >
          <p>
            Your settings go back to how they were {formatTime(backup.savedAt)}. Your current settings become the backup,
            so you can switch back.
          </p>
        </ConfirmDialog>
      )}
      {repairing !== null && (
        <ConfirmDialog
          title={`Repair ${docName(repairing)}?`}
          confirmLabel="Repair"
          danger
          onConfirm={() => {
            send({ op: 'repairDoc', key: repairing });
            // Its row, and the Repair button focus would return to, go away: the next Repair button takes focus, or
            // Export once none are left.
            focusAfterRender(() => repairList.current?.querySelector('button') ?? exportButton.current);
          }}
          onClose={() => {
            setRepairing(null);
          }}
        >
          <p>AnyKey keeps everything this version can read and deletes the rest.</p>
          {data.problems.get(repairing) === 'newer' && (
            <p>A newer version of AnyKey saved these. Updating AnyKey instead keeps all of them.</p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}

function ImportSummary({ preview }: { preview: ImportPreview }) {
  const { state, problems } = preview.data;
  const siteShortcuts = [...state.sites.values()].reduce((sum, site) => sum + site.shortcuts.length, 0);
  const exported = preview.file.exportedAt === undefined ? Number.NaN : Date.parse(preview.file.exportedAt);
  const lines = [
    count(Object.keys(state.settings).length, 'changed setting'),
    count(state.global.overrides.size, 'changed built-in shortcut'),
    count(state.global.shortcuts.length + siteShortcuts, 'shortcut of your own', 'shortcuts of your own'),
    count(state.sites.size, 'site with its own settings', 'sites with their own settings'),
  ];
  return (
    <>
      <p>{Number.isNaN(exported) ? 'The file holds:' : `The file was exported ${formatTime(exported)} and holds:`}</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {problems.size > 0 && (
        <p>
          Some parts can't be read by this version of AnyKey and are left out:{' '}
          {[...problems.keys()].map(docName).join(', ')}.
        </p>
      )}
    </>
  );
}

function StorageMeters({ data }: { data: SyncData }) {
  const id = useId();
  const sizes = Object.entries(data.items).map(([key, value]) => ({ key, bytes: itemBytes(key, value) }));
  const total = sizes.reduce((sum, item) => sum + item.bytes, 0);
  const fullest = sizes.reduce<{ key: string; bytes: number } | null>(
    (max, item) => (max === null || item.bytes > max.bytes ? item : max),
    null,
  );
  return (
    <div className="mt-2 grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor={`${id}-total`} className="block text-sm">
          All synced settings
        </label>
        <meter
          id={`${id}-total`}
          min={0}
          max={SYNC_QUOTA.totalBytes}
          high={SYNC_QUOTA.totalBytes * 0.8}
          value={total}
          className="mt-1 h-3 w-full"
        />
        <p className={hintText}>
          {formatBytes(total)} of {formatBytes(SYNC_QUOTA.totalBytes)}
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-item`} className="block text-sm">
          Largest part{fullest === null ? '' : `: ${docName(fullest.key)}`}
        </label>
        <meter
          id={`${id}-item`}
          min={0}
          max={SYNC_QUOTA.itemBytes}
          high={SYNC_QUOTA.itemBytes * 0.8}
          value={fullest?.bytes ?? 0}
          className="mt-1 h-3 w-full"
        />
        <p className={hintText}>
          {formatBytes(fullest?.bytes ?? 0)} of {formatBytes(SYNC_QUOTA.itemBytes)}. Each part must fit on its own.
        </p>
      </div>
    </div>
  );
}

/** Checks a chosen file. Returns what it holds, or a message for the user. */
async function readImport(file: File): Promise<ImportPreview | string> {
  const notSettings = "This file isn't an AnyKey settings export.";
  if (file.size > MAX_IMPORT_BYTES) return notSettings;
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return notSettings;
  }
  const parsed = ExportFileSchema.safeParse(json);
  if (!parsed.success) return notSettings;
  if (parsed.data.version > EXPORT_VERSION) {
    return 'This file comes from a newer version of AnyKey. Update AnyKey, then import it again.';
  }
  return { file: parsed.data, data: parseSync(parsed.data.items) };
}

function downloadExport(data: SyncData): void {
  const file: ExportFile = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    items: data.items,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `anykey-settings-${localDate(new Date())}.json`;
  link.click();
  // The download has started by the time this runs.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

function localDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(ms: number): string {
  return `on ${new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${Number((bytes / 1024).toFixed(1))} KB`;
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
