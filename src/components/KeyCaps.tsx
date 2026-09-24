import { Fragment } from 'react';
import { keycapLabels } from '@/core/keys';
import type { KeyMode } from '@/core/schema';
import { isMac } from './platform';

/** A shortcut's keys as keycaps: "g g" shows as [g] then [g], "mod+k" as [⌘][K] on macOS and [Ctrl]+[K] elsewhere. */
export function KeyCaps({ keys, mode }: { keys: string; mode: KeyMode }) {
  const chords = keycapLabels(keys, mode, isMac);
  if (chords === null) return <span className="text-sm text-stone-600 dark:text-stone-400">{keys}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm">
      {chords.map((labels, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-xs text-stone-600 dark:text-stone-400">then</span>}
          {labels.map((label, j) => (
            <Fragment key={j}>
              {j > 0 && !isMac && <span aria-hidden="true">+</span>}
              <kbd className="min-w-6 rounded border border-b-2 border-stone-300 bg-stone-50 px-1.5 py-0.5 text-center font-sans text-xs font-medium dark:border-stone-600 dark:bg-stone-800">
                {label}
              </kbd>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}
