// The checks `pnpm lint:locales` runs on each language in src/locales (scripts/check-locales.ts).

/** A message as `parseMessagesFile` in @wxt-dev/i18n/build reads it. */
export interface LocaleMessage {
  type: string;
  key: string[];
  substitutions: number;
  namedSubstitutions: string[];
  message?: string;
  plurals?: Record<string, string>;
}

/** The longest text Chrome and its store accept for the manifest's fields. */
const LIMITS: Record<string, number> = { 'manifest.name': 75, 'manifest.shortName': 12, 'manifest.description': 132 };

function textsOf(message: LocaleMessage): string[] {
  return message.plurals === undefined ? [message.message ?? ''] : Object.values(message.plurals);
}

function own(messages: readonly LocaleMessage[]): Map<string, LocaleMessage> {
  // The module adds Chrome's predefined messages to every file.
  return new Map(messages.filter(({ key }) => !key[0]?.startsWith('@@')).map((message) => [message.key.join('.'), message]));
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join() === [...b].sort().join();
}

/** What is wrong with a language, as one line each. A message it leaves out is fine: Chrome shows the English one. */
export function checkLocale(
  name: string,
  messages: readonly LocaleMessage[],
  english: readonly LocaleMessage[],
  supported: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  const base = own(english);
  const mine = own(messages);
  if (!supported.has(name)) problems.push(`"${name}" is not a language Chrome supports`);
  const tag = mine.get('locale')?.message;
  if (tag !== name.replace('_', '-')) problems.push(`"locale" must be "${name.replace('_', '-')}"`);

  for (const [key, message] of mine) {
    const source = base.get(key);
    if (source === undefined) {
      problems.push(`${key}: not in en.json (outdated or misspelled)`);
      continue;
    }
    const texts = textsOf(message);
    if (texts.some((text) => text.trim() === '')) problems.push(`${key}: empty`);
    if (texts.some((text) => text.includes(' | '))) problems.push(`${key}: " | " separates plural forms, so leave it out`);
    if (message.type !== source.type || !sameNames(Object.keys(message.plurals ?? {}), Object.keys(source.plurals ?? {}))) {
      problems.push(`${key}: needs the same forms as English`);
    }
    if (message.substitutions !== source.substitutions || !sameNames(message.namedSubstitutions, source.namedSubstitutions)) {
      problems.push(`${key}: needs the same {placeholders} as English (${source.namedSubstitutions.join(', ') || 'none'})`);
    }
    const limit = LIMITS[key];
    if (limit !== undefined && (message.message ?? '').length > limit) problems.push(`${key}: longer than ${limit} characters`);
  }
  return problems;
}
