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
import { listText, locale, t } from '@/i18n';
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
        {t('data.heading')}
      </h2>

      {data.problems.size > 0 && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <h3 className="text-sm font-semibold">{t('data.attention')}</h3>
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
                  {t('data.repair')}
                  <span className="sr-only"> {docName(key)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={hintText}>{t('data.intro')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          ref={exportButton}
          type="button"
          onClick={() => {
            downloadExport(data);
          }}
          className={secondaryButton}
        >
          {t('data.export')}
        </button>
        <button
          type="button"
          onClick={() => {
            fileInput.current?.click();
          }}
          className={secondaryButton}
        >
          {t('data.import')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label={t('data.fileLabel')}
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

      <h3 className="mt-6 text-sm font-semibold">{t('data.backup')}</h3>
      {backup === null ? (
        <p className={hintText}>{t('data.noBackup')}</p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm">{t('data.backupSaved', { time: formatTime(backup.savedAt) })}</p>
          <button
            type="button"
            onClick={() => {
              setRestoring(true);
            }}
            className={secondaryButton}
          >
            {t('data.restore')}
          </button>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">{t('data.storage')}</h3>
      <StorageMeters data={data} />

      {preview !== null && (
        <ConfirmDialog
          title={t('data.replaceTitle')}
          confirmLabel={t('data.replaceConfirm')}
          onConfirm={() => {
            send({ op: 'replaceAll', items: preview.file.items });
          }}
          onClose={() => {
            setPreview(null);
          }}
        >
          <ImportSummary preview={preview} />
          <p>{t('data.replaceBody')}</p>
        </ConfirmDialog>
      )}
      {restoring && backup !== null && (
        <ConfirmDialog
          title={t('data.restoreTitle')}
          confirmLabel={t('data.restore')}
          onConfirm={() => {
            send({ op: 'restoreBackup' });
          }}
          onClose={() => {
            setRestoring(false);
          }}
        >
          <p>{t('data.restoreBody', { time: formatTime(backup.savedAt) })}</p>
        </ConfirmDialog>
      )}
      {repairing !== null && (
        <ConfirmDialog
          title={t('data.repairTitle', { name: docName(repairing) })}
          confirmLabel={t('data.repair')}
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
          <p>{t('data.repairBody')}</p>
          {data.problems.get(repairing) === 'newer' && <p>{t('data.repairNewer')}</p>}
        </ConfirmDialog>
      )}
    </section>
  );
}

function ImportSummary({ preview }: { preview: ImportPreview }) {
  const { state, problems } = preview.data;
  const siteShortcuts = [...state.sites.values()].reduce((sum, site) => sum + site.shortcuts.length, 0);
  const presetChanges = [...state.presets.values()].reduce((sum, overrides) => sum + overrides.size, 0);
  const exported = preview.file.exportedAt === undefined ? Number.NaN : Date.parse(preview.file.exportedAt);
  const count = (n: number) => [n, { count: n }] as const;
  const lines = [
    t('data.settingsCount', ...count(Object.keys(state.settings).length)),
    t('data.builtInCount', ...count(state.global.overrides.size)),
    t('data.presetCount', ...count(presetChanges)),
    t('data.ownCount', ...count(state.global.shortcuts.length + siteShortcuts)),
    t('data.sitesCount', ...count(state.sites.size)),
  ];
  return (
    <>
      <p>{Number.isNaN(exported) ? t('data.fileHolds') : t('data.fileExported', { time: formatTime(exported) })}</p>
      <ul className="list-disc space-y-0.5 pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {problems.size > 0 && (
        <p>{t('data.leftOut', { parts: listText([...problems.keys()].map(docName)) })}</p>
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
          {t('data.allSynced')}
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
          {t('data.ofTotal', { used: formatBytes(total), total: formatBytes(SYNC_QUOTA.totalBytes) })}
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-item`} className="block text-sm">
          {fullest === null ? t('data.largest') : t('data.largestNamed', { name: docName(fullest.key) })}
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
          {t('data.ofItem', { used: formatBytes(fullest?.bytes ?? 0), total: formatBytes(SYNC_QUOTA.itemBytes) })}
        </p>
      </div>
    </div>
  );
}

/** Checks a chosen file. Returns what it holds, or a message for the user. */
async function readImport(file: File): Promise<ImportPreview | string> {
  const notSettings = t('data.notSettings');
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
    return t('data.newer');
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
  return new Date(ms).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
}

/** "512 bytes", "1.5 kB", in the language's own words and digits. */
function formatBytes(bytes: number): string {
  return bytes < 1024
    ? new Intl.NumberFormat(locale(), { style: 'unit', unit: 'byte', unitDisplay: 'long' }).format(bytes)
    : new Intl.NumberFormat(locale(), { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(
        bytes / 1024,
      );
}
