// Text helpers shared by the picker, targets and the options page.

// Generated from src/locales/en.json by `wxt prepare`: types only, so core stays free of the extension APIs.
import type { GeneratedI18nStructure } from '../../.wxt/i18n/structure';

/**
 * Words core hands to the UI: a message in src/locales, with its `{name}` substitutions and, for a plural, the count.
 * Core never holds English of its own; callers turn this into the user's language (`textOf` in src/i18n.ts).
 */
export interface Text {
  key: keyof GeneratedI18nStructure;
  args?: Readonly<Record<string, string | number>>;
  count?: number;
}

/** Text as AnyKey stores and compares it: runs of whitespace become one space, and the ends are trimmed. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Whether an element's text is the text a target was saved with. Case, spacing and numbers don't count, since
 * counts such as "Like 1,203" change; text with nothing but numbers and punctuation never matches.
 */
export function sameText(text: string, saved: string): boolean {
  const key = textKey(saved);
  return /[^\s#\p{P}\p{S}]/u.test(key) && textKey(text) === key;
}

function textKey(text: string): string {
  return normalizeText(text.replace(/\d(?:[\d.,]*\d)?/g, '#')).toLowerCase();
}

/** At most `max` UTF-16 units, ending in "…" when cut, without splitting a surrogate pair. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut}…`;
}
