import type { Conflict } from '@/core/conflicts';

/** How the options page explains a conflict. */
export function conflictText(conflict: Conflict): string {
  switch (conflict.kind) {
    case 'shadowed':
      return `Doesn't run: "${conflict.by.label}" uses these keys.`;
    case 'shadows':
      return `"${conflict.other.label}" doesn't run, because this shortcut uses its keys.`;
    case 'waits':
      return `Runs after a short pause, because "${conflict.longer.label}" starts with the same keys.`;
    case 'reserved':
      return 'The browser keeps these keys for itself, so this shortcut never runs.';
    case 'typing':
      return "Also runs in text fields, so you can't type these keys there.";
  }
}
