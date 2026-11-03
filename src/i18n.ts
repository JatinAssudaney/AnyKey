import { i18n, type GeneratedI18nStructure } from '#i18n';
import type { Text } from '@/core/text';

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

type Untyped = (key: string, ...args: (number | Record<string, string | number>)[]) => string;

/** Text from src/core, which names a message rather than holding words of its own. */
export function textOf(text: Text): string {
  const translate = t as unknown as Untyped;
  const args = Object.fromEntries(Object.entries(text.args ?? {}).map(([name, value]) => [name, String(value)]));
  return text.count === undefined ? translate(text.key, args) : translate(text.key, text.count, args);
}
