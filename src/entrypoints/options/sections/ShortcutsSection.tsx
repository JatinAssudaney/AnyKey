import { useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { focusAfterRender } from '@/components/focus';
import { isMac } from '@/components/platform';
import { card, hintText, linkButton, primaryButton, sectionHeading } from '@/components/styles';
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
}

export function ShortcutsSection({ data, presets, mutate }: ShortcutsSectionProps) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Shortcut | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
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

      {editing !== null && (
        <ShortcutDialog
          editing={editing}
          data={data}
          presets={presets}
          onSave={send}
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
