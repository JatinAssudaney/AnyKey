import { generateChromeMessages, parseMessagesFile } from '@wxt-dev/i18n/build';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// fakeBrowser leaves out browser.i18n, so tests read the English messages, as the browser would with English as its
// language. Text assertions in tests are English.
const messages = generateChromeMessages(await parseMessagesFile('src/locales/en.json'));

fakeBrowser.i18n.getMessage = (name: string, substitutions?: string | (string | number)[]): string => {
  const subs = typeof substitutions === 'string' ? [substitutions] : (substitutions ?? []);
  const message = messages[name]?.message ?? '';
  // Chrome's rules: $1 to $9 take the substitutions, and $$ is a dollar sign.
  return message.replace(/\$(\$|[1-9])/g, (_, which: string) => (which === '$' ? '$' : String(subs[Number(which) - 1] ?? '')));
};
fakeBrowser.i18n.getUILanguage = () => 'en';
