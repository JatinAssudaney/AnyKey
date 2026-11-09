import { i18n, type GeneratedI18nStructure } from '#i18n';
import { keycapLabels } from './core/keys';
import type { KeyMode, Shortcut } from './core/schema';
import type { Text, TextArg } from './core/text';

// The extension's own text, from src/locales/<lang>.json in the browser's language (rules in docs/design.md, "Text
// and languages"). Shared by every context: extension pages, the content script and the service worker.

/** A message in the browser's language, with its `{name}` substitutions and, for plurals, the count. */
export const t = i18n.t;

/** A message with no substitutions and no plural forms, which `t(key)` takes on its own. */
export type MessageKey = {
  [K in keyof GeneratedI18nStructure]: GeneratedI18nStructure[K] extends { plural: false; substitutions: 0 }
    ? GeneratedI18nStructure[K] extends { namedSubstitutions: readonly string[] }
      ? never
      : K
    : never;
}[keyof GeneratedI18nStructure];

/** The language of the text shown (the locale file the browser picked, not its UI language), as a BCP 47 tag. */
export function locale(): string {
  return t('locale');
}

/** Items joined the way the language joins them: "a, b and c". */
export function listText(items: readonly string[]): string {
  return new Intl.ListFormat(locale(), { type: 'conjunction' }).format(items);
}

/** Names in a sentence, each in the language's quotes: "a", "b" and "c". */
export function quotedList(names: readonly string[]): string {
  return listText(names.map((text) => t('common.quoted', { text })));
}

type Untyped = (key: string, ...args: (number | Record<string, string>)[]) => string;

function argText(arg: TextArg): string {
  if (typeof arg !== 'object') return String(arg);
  return 'quoted' in arg ? quotedList(arg.quoted) : textOf(arg);
}

/** Text from src/core, which names a message rather than holding words of its own. */
export function textOf(text: Text): string {
  const translate = t as unknown as Untyped;
  const args = Object.fromEntries(Object.entries(text.args ?? {}).map(([name, value]) => [name, argText(value)]));
  return text.count === undefined ? translate(text.key, args) : translate(text.key, text.count, args);
}

/** A zod issue's message, which core's schemas write with `textMessage`. */
export function textOfMessage(message: string): string {
  try {
    return textOf(JSON.parse(message) as Text);
  } catch {
    return message;
  }
}

/** What a shortcut is called: a built-in shortcut's label names a message, and the others hold their own text. */
export function shortcutLabel(shortcut: Pick<Shortcut, 'label' | 'source'>): string {
  return shortcut.source === 'default' ? textOf({ key: shortcut.label as Text['key'] }) : shortcut.label;
}

/** Keycap labels in the user's language: one array per chord. Null for notation that doesn't parse. */
export function keycaps(keys: string, mode: KeyMode, isMac: boolean): string[][] | null {
  return (
    keycapLabels(keys, mode, isMac)?.map((chord) =>
      chord.map((cap) => (typeof cap === 'string' ? cap : textOf(cap))),
    ) ?? null
  );
}

/** Keys as a sentence says them: "g then s", "Ctrl+K", "⌘K". Empty for notation that doesn't parse. */
export function keysInWords(keys: string, mode: KeyMode, isMac: boolean): string {
  const chords = keycaps(keys, mode, isMac) ?? [];
  return chords.map((labels) => labels.join(isMac ? '' : '+')).join(` ${t('keys.then')} `);
}
