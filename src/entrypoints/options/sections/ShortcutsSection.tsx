import { useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { focusAfterRender } from '@/components/focus';
import { isMac } from '@/components/platform';
import { CommandKeyCaps } from '@/components/KeyCaps';
import { rich } from '@/components/rich';
import { card, hintText, linkButton, primaryButton, secondaryButton, sectionHeading } from '@/components/styles';
import { openShortcutsPage, usePanelKey } from '@/components/usePanelKey';
import { findConflicts } from '@/core/conflicts';
import type { SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import type { Preset } from '@/core/presets';
import { effectiveDefaults } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
import { t } from '@/i18n';
import { ShortcutDialog, type Editing } from './ShortcutDialog';
import { editButtonId, ShortcutTable } from './ShortcutTable';

interface ShortcutsSectionProps {
  data: SyncData;
  presets: readonly Preset[];
  mutate: (mutation: Mutation) => Promise<string | null>;
  /** Opens a site in the Sites section, for a shortcut saved to it here. */
  onShowSite: (host: string) => void;
}

export function ShortcutsSection({ data, presets, mutate, onShowSite }: ShortcutsSectionProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Shortcut | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const panelKey = usePanelKey();
  const { state } = data;
  const defaults = useMemo(() => effectiveDefaults(state), [state]);
  const conflicts = useMemo(
    () => findConflicts([...defaults, ...state.global.shortcuts], isMac),
    [defaults, state.global.shortcuts],
  );
  const send = (mutation: Mutation): void => {
    void mutate(mutation);
  };

  return (
    <section aria-labelledby="shortcuts-heading" className={card}>
      <h2 id="shortcuts-heading" className={sectionHeading}>
        {t('shortcuts.heading')}
      </h2>
      <p className={hintText}>{t('shortcuts.intro')}</p>

      <ShortcutTable
        caption={t('shortcuts.builtIn')}
        shortcuts={defaults}
        conflicts={conflicts}
        onToggle={(shortcut, enabled) => {
          send({ op: 'setDefault', id: shortcut.id, enabled });
        }}
        onEdit={(shortcut) => {
          setEditing({ kind: 'default', shortcut });
        }}
        extra={(shortcut) =>
          state.global.overrides.has(shortcut.id) ? (
            <button
              type="button"
              onClick={() => {
                send({ op: 'resetDefault', id: shortcut.id });
                // The Reset button goes away with the change, so focus moves to the row's Edit button.
                focusAfterRender(() => document.getElementById(editButtonId(shortcut)));
              }}
              className={linkButton}
            >
              {t('common.reset')}
              <span className="sr-only"> {shortcut.label}</span>
            </button>
          ) : null
        }
      />

      {state.global.shortcuts.length === 0 ? (
        <>
          <h3 className="mt-8 text-sm font-semibold">{t('shortcuts.yours')}</h3>
          <p className={hintText}>{t('shortcuts.noneYet')}</p>
        </>
      ) : (
        <ShortcutTable
          caption={t('shortcuts.yours')}
          shortcuts={state.global.shortcuts}
          conflicts={conflicts}
          describe
          onToggle={(shortcut, enabled) => {
            send({ op: 'saveShortcut', shortcut: { ...shortcut, enabled } });
          }}
          onEdit={(shortcut) => {
            setEditing({ kind: 'user', shortcut });
          }}
          extra={(shortcut) => (
            <button
              type="button"
              onClick={() => {
                setDeleting(shortcut);
              }}
              className={linkButton}
            >
              {t('common.delete')}
              <span className="sr-only"> {shortcut.label}</span>
            </button>
          )}
        />
      )}
      <button
        ref={addButton}
        type="button"
        onClick={() => {
          setEditing({ kind: 'new' });
        }}
        className={`${primaryButton} mt-4`}
      >
        {t('shortcuts.add')}
      </button>

      {panelKey !== null && (
        <>
          <h3 className="mt-8 text-sm font-semibold">{t('shortcuts.panelHeading')}</h3>
          <p className={hintText}>
            {panelKey === ''
              ? t('shortcuts.noPanelKey')
              : rich('shortcuts.panelKey', { keys: <CommandKeyCaps shortcut={panelKey} /> })}{' '}
            {t('shortcuts.browserHolds')}
          </p>
          <button type="button" onClick={openShortcutsPage} className={`${secondaryButton} mt-3`}>
            {panelKey === '' ? t('common.setKey') : t('shortcuts.changeKey')}
          </button>
        </>
      )}

      {editing !== null && (
        <ShortcutDialog
          editing={editing}
          data={data}
          presets={presets}
          onSave={(mutation) => {
            if (mutation.op === 'saveShortcut' && mutation.site !== undefined) onShowSite(mutation.site);
            send(mutation);
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          title={t('common.deleteTitle', { label: deleting.label })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => {
            send({ op: 'deleteShortcut', id: deleting.id });
            // Its row, and the Delete button focus would return to, go away.
            focusAfterRender(() => addButton.current);
          }}
          onClose={() => {
            setDeleting(null);
          }}
        >
          <p>{t('common.deleteBody')}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
