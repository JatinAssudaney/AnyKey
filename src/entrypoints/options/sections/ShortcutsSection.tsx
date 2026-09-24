import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { conflictText } from '@/components/conflictText';
import { focusAfterRender } from '@/components/focus';
import { KeyCaps } from '@/components/KeyCaps';
import { isMac } from '@/components/platform';
import { card, checkbox, hintText, linkButton, primaryButton, sectionHeading } from '@/components/styles';
import { findConflicts, type Conflict } from '@/core/conflicts';
import type { SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { effectiveDefaults } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
import { describeAction } from '../actions';
import { ShortcutDialog, type Editing } from './ShortcutDialog';

interface ShortcutsSectionProps {
  data: SyncData;
  mutate: (mutation: Mutation) => Promise<string | null>;
}

export function ShortcutsSection({ data, mutate }: ShortcutsSectionProps) {
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

interface ShortcutTableProps {
  caption: string;
  shortcuts: readonly Shortcut[];
  conflicts: ReadonlyMap<string, readonly Conflict[]>;
  /** Show what each shortcut does under its name. */
  describe?: boolean;
  onToggle: (shortcut: Shortcut, enabled: boolean) => void;
  onEdit: (shortcut: Shortcut) => void;
  /** A second row action after Edit. */
  extra: (shortcut: Shortcut) => ReactNode;
}

function ShortcutTable({ caption, shortcuts, conflicts, describe = false, onToggle, onEdit, extra }: ShortcutTableProps) {
  return (
    <table className="mt-6 w-full table-fixed border-collapse text-left text-sm">
      <caption className="mb-2 text-left text-sm font-semibold">{caption}</caption>
      <thead>
        <tr className="border-b border-stone-200 text-xs text-stone-600 dark:border-stone-700 dark:text-stone-400">
          <th scope="col" className="w-12 py-2 pr-2 font-medium">
            On
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Name
          </th>
          <th scope="col" className="w-44 py-2 pr-4 font-medium">
            Keys
          </th>
          <th scope="col" className="w-32 py-2 font-medium">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {shortcuts.map((shortcut) => {
          const notes = conflicts.get(shortcut.id) ?? [];
          return (
            <tr key={shortcut.id} className="border-b border-stone-100 align-top last:border-0 dark:border-stone-800">
              <td className="py-2.5 pr-2">
                <input
                  type="checkbox"
                  checked={shortcut.enabled}
                  onChange={(event) => {
                    onToggle(shortcut, event.target.checked);
                  }}
                  aria-label={`Use ${shortcut.label}`}
                  className={`${checkbox} mt-0.5`}
                />
              </td>
              <th scope="row" className="py-2.5 pr-4 font-normal">
                <span className={shortcut.enabled ? '' : 'text-stone-500 dark:text-stone-400'}>{shortcut.label}</span>
                {describe && describeAction(shortcut.action) !== shortcut.label && (
                  <span className="block text-xs text-stone-600 dark:text-stone-400">
                    {describeAction(shortcut.action)}
                  </span>
                )}
                {notes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                    {notes.map((conflict, i) => (
                      <li key={i}>
                        <span aria-hidden="true">⚠ </span>
                        {conflictText(conflict)}
                      </li>
                    ))}
                  </ul>
                )}
              </th>
              <td className="py-2.5 pr-4">
                <KeyCaps keys={shortcut.keys} mode={shortcut.keyMode} />
              </td>
              <td className="py-2 text-right whitespace-nowrap">
                <button
                  id={editButtonId(shortcut)}
                  type="button"
                  onClick={() => {
                    onEdit(shortcut);
                  }}
                  className={linkButton}
                >
                  Edit<span className="sr-only"> {shortcut.label}</span>
                </button>
                {extra(shortcut)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function editButtonId(shortcut: Shortcut): string {
  return `edit-${shortcut.id}`;
}
