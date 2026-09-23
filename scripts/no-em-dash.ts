// Fails when an em dash (U+2014) appears in any file git tracks or would track.
// Project rule: use commas, colons, periods or parentheses instead.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EM_DASH = String.fromCharCode(0x2014);
const SKIP = new Set(['pnpm-lock.yaml']);

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file !== '' && !SKIP.has(file));

let found = 0;
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // staged for deletion
  }
  text.split('\n').forEach((line, index) => {
    if (line.includes(EM_DASH)) {
      console.error(`${file}:${index + 1}: ${line.trim()}`);
      found += 1;
    }
  });
}

if (found > 0) {
  console.error(`\n${found} line(s) contain an em dash. Use commas, colons, periods or parentheses instead.`);
  process.exit(1);
}
