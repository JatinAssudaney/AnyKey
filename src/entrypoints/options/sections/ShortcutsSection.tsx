import { useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { focusAfterRender } from '@/components/focus';
import { isMac } from '@/components/platform';
import { CommandKeyCaps } from '@/components/KeyCaps';
import { card, hintText, linkButton, primaryButton, secondaryButton, sectionHeading } from '@/components/styles';
import { openShortcutsPage, usePanelKey } from '@/components/usePanelKey';
import { findConflicts } from '@/core/conflicts';
import type { SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import type { Preset } from '@/core/presets';
import { effectiveDefaults } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
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
        Shortcuts
      </h2>
      <p className={hintText}>These work on every site. Changes apply to open tabs right away.</p>

      <ShortcutTable
        caption="Built-in shortcuts"
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
              Reset<span className="sr-only"> {shortcut.label}</span>
            </button>
          ) : null
        }
      />

      {state.global.shortcuts.length === 0 ? (
        <>
          <h3 className="mt-8 text-sm font-semibold">Your shortcuts</h3>
          <p className={hintText}>None yet. Add one to scroll, switch tabs or open a web address with your own keys.</p>
        </>
      ) : (
        <ShortcutTable
          caption="Your shortcuts"
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
              Delete<span className="sr-only"> {shortcut.label}</span>
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
        Add shortcut
      </button>

      {panelKey !== null && (
        <>
          <h3 className="mt-8 text-sm font-semibold">AnyKey&apos;s panel</h3>
          <p className={hintText}>
            {panelKey === '' ? (
              <>No key opens the panel from AnyKey&apos;s toolbar button.</>
            ) : (
              <>
                Press <CommandKeyCaps shortcut={panelKey} /> in any tab to open the panel from AnyKey&apos;s toolbar
                button, even on pages where AnyKey&apos;s other shortcuts can&apos;t run.
              </>
            )}{' '}
            The browser holds the key, so it is set on the browser&apos;s page for extension shortcuts.
          </p>
          <button type="button" onClick={openShortcutsPage} className={`${secondaryButton} mt-3`}>
            {panelKey === '' ? 'Set a key' : 'Change the key'}
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
          title={`Delete "${deleting.label}"?`}
          confirmLabel="Delete"
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
          <p>This removes the shortcut from every computer you sync with.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
