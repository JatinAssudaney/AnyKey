// Checks every language in src/locales against English (see checkLocale), and says how much of each is translated.
import { readdirSync } from 'node:fs';
import { parseMessagesFile, SUPPORTED_LOCALES } from '@wxt-dev/i18n/build';
import { checkLocale } from '../src/locales/check.ts';

const english = await parseMessagesFile('src/locales/en.json');
const total = english.filter(({ key }) => !key[0]?.startsWith('@@')).length;
let failed = false;

for (const file of readdirSync('src/locales').filter((name) => name.endsWith('.json'))) {
  const name = file.slice(0, -'.json'.length);
  const messages = await parseMessagesFile(`src/locales/${file}`);
  const problems = checkLocale(name, messages, english, SUPPORTED_LOCALES);
  const count = messages.filter(({ key }) => !key[0]?.startsWith('@@')).length;
  console.log(`${name}: ${count} of ${total} messages`);
  for (const problem of problems) console.error(`  src/locales/${file}: ${problem}`);
  failed ||= problems.length > 0;
}
if (failed) process.exitCode = 1;
