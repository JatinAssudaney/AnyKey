import { Fragment, type ReactNode } from 'react';
import type { GeneratedI18nStructure } from '#i18n';
import { locale, t } from '@/i18n';

type Structure = GeneratedI18nStructure;
type Named = {
  [K in keyof Structure]: Structure[K] extends { namedSubstitutions: readonly string[] } ? K : never;
}[keyof Structure];
type Names<K extends Named> = Structure[K] extends { namedSubstitutions: readonly (infer N extends string)[] }
  ? N
  : never;
type Untyped = (key: string, ...args: (number | Record<string, string>)[]) => string;

/** Marks where a node goes in translated text: a character no message holds. */
const MARK = '\u0000';

/**
 * A message whose `{name}` substitutions are elements (keycaps, code, links), so translators keep whole sentences
 * and put the elements where their language wants them. Pass `count` for a plural message.
 */
export function rich<K extends Named>(key: K, nodes: Record<Names<K>, ReactNode>, count?: number): ReactNode {
  const entries: [string, ReactNode][] = Object.entries(nodes);
  const marks = Object.fromEntries(entries.map(([name], i) => [name, `${MARK}${i}${MARK}`]));
  const translate = t as unknown as Untyped;
  const text = count === undefined ? translate(key, marks) : translate(key, count, marks);
  return text
    .split(MARK)
    .map((part, i) => (i % 2 === 0 ? part : <Fragment key={i}>{entries[Number(part)]?.[1]}</Fragment>));
}

/** Elements in a sentence, joined the way the language joins a list: [j], [k] and [x]. */
export function listNodes(nodes: readonly ReactNode[]): ReactNode {
  const parts = new Intl.ListFormat(locale(), { type: 'conjunction' }).formatToParts(
    nodes.map((_, i) => `${MARK}${i}${MARK}`),
  );
  return parts.map((part, i) =>
    part.type === 'element' ? <Fragment key={i}>{nodes[Number(part.value.slice(1, -1))]}</Fragment> : part.value,
  );
}
