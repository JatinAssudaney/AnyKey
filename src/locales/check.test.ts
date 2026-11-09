import { parseMessagesObject, SUPPORTED_LOCALES } from '@wxt-dev/i18n/build';
import { describe, expect, it } from 'vitest';
import { checkLocale } from './check';

const english = parseMessagesObject({
  locale: 'en',
  manifest: { shortName: 'AnyKey' },
  hello: 'Hello {name}',
  shortcuts: { 1: '1 shortcut', n: '{count} shortcuts' },
});
const check = (name: string, messages: Record<string, unknown>): string[] =>
  checkLocale(name, parseMessagesObject({ locale: name.replace('_', '-'), ...messages }), english, SUPPORTED_LOCALES);

describe('checkLocale', () => {
  it('accepts a good translation, and one that leaves messages out', () => {
    expect(check('de', { hello: 'Hallo {name}', shortcuts: { 1: '1 Kürzel', n: '{count} Kürzel' } })).toEqual([]);
    expect(check('zh_CN', {})).toEqual([]);
  });

  it('refuses a language Chrome lacks, or a locale tag that is not the file name', () => {
    expect(check('xx', {})[0]).toContain('not a language Chrome supports');
    expect(checkLocale('de', parseMessagesObject({ locale: 'fr' }), english, SUPPORTED_LOCALES)[0]).toContain('"locale"');
  });

  it('refuses unknown keys, empty text and changed placeholders or forms', () => {
    expect(check('de', { helo: 'x' })[0]).toContain('not in en.json');
    expect(check('de', { hello: ' ' }).join()).toContain('empty');
    expect(check('de', { hello: 'Hallo {nam}' })[0]).toContain('placeholders');
    expect(check('de', { hello: 'Hallo $1 {name}' })[0]).toContain('placeholders');
    expect(check('de', { shortcuts: '{count} Kürzel' }).join()).toContain('same forms');
    expect(check('de', { hello: 'Hallo {name} | x' })[0]).toContain('plural');
  });

  it('holds the manifest to Chrome\'s limits', () => {
    expect(check('de', { manifest: { shortName: 'Viel zu langer Name' } })[0]).toContain('longer than 12');
  });
});
