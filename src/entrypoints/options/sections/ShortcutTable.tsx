import type { ReactNode } from 'react';
import { KeyCaps } from '@/components/KeyCaps';
import { checkbox, linkButton } from '@/components/styles';
import { describeConflict, type Conflict } from '@/core/conflicts';
import type { Shortcut } from '@/core/schema';
import { describeAction } from '../actions';

interface ShortcutTableProps {
  caption: string;
  /** Shows the caption to screen readers only, when a heading above already says it. */
  hideCaption?: boolean;
  shortcuts: readonly Shortcut[];
  conflicts: ReadonlyMap<string, readonly Conflict[]>;
  /** Show what each shortcut does under its name. */
  describe?: boolean;
  onToggle: (shortcut: Shortcut, enabled: boolean) => void;
  onEdit: (shortcut: Shortcut) => void;
  /** A second row action after Edit. */
  extra: (shortcut: Shortcut) => ReactNode;
}

export function ShortcutTable({
  caption,
  hideCaption = false,
  shortcuts,
  conflicts,
  describe = false,
  onToggle,
  onEdit,
  extra,
}: ShortcutTableProps) {
  return (
    <table className="mt-6 w-full table-fixed border-collapse text-left text-sm">
      <caption className={hideCaption ? 'sr-only' : 'mb-2 text-left text-sm font-semibold'}>{caption}</caption>
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
          const description = describeAction(shortcut.action);
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
                {describe && description !== shortcut.label && (
                  <span className="block text-xs break-words text-stone-600 dark:text-stone-400">{description}</span>
                )}
                {notes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                    {notes.map((conflict, i) => (
                      <li key={i}>
                        <span aria-hidden="true">⚠ </span>
                        {describeConflict(conflict)}
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

/** The id of a shortcut's Edit button, where focus goes when a change moves the shortcut or removes a control. */
export function editButtonId(shortcut: Pick<Shortcut, 'id'>): string {
  return `edit-${shortcut.id}`;
}
