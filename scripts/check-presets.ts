// Checks what the preset schema can't see, for every file in presets/:
// - the file is named after the preset's id;
// - the preset has a live test, e2e/live/<id>.spec.ts, or a reason in MANUAL why it is checked by hand;
// - a preset that differs from the one on main has a higher version, so installed copies update.
// The base is origin/main, or PRESETS_BASE. Without it (a clone with no remote) the version check is skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** Presets with no live test, and why. */
const MANUAL: Record<string, string> = {
  reddit: 'Reddit shows automated browsers a reCAPTCHA page.',
};

const base = process.env.PRESETS_BASE ?? 'origin/main';
const problems: string[] = [];

function git(...args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return undefined;
  }
}

function field(preset: unknown, name: string): unknown {
  return typeof preset === 'object' && preset !== null ? (preset as Record<string, unknown>)[name] : undefined;
}

const hasBase = git('rev-parse', '--verify', '--quiet', `${base}^{commit}`) !== undefined;
if (!hasBase) console.warn(`check-presets: no ${base} to compare with, so preset versions go unchecked.`);

for (const file of readdirSync('presets').filter((name) => name.endsWith('.json'))) {
  const path = `presets/${file}`;
  const name = file.slice(0, -'.json'.length);
  let preset: unknown;
  try {
    preset = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    problems.push(`${path}: not valid JSON (${String(error)})`);
    continue;
  }

  const id = field(preset, 'id');
  if (id !== name) problems.push(`${path}: the file must be named after the preset's id ("${String(id)}.json")`);
  if (!existsSync(`e2e/live/${name}.spec.ts`) && MANUAL[name] === undefined) {
    problems.push(`${path}: add a live test, e2e/live/${name}.spec.ts (see CONTRIBUTING.md)`);
  }

  if (!hasBase) continue;
  const before = git('show', `${base}:${path}`);
  if (before === undefined) continue; // a new preset
  let old: unknown;
  try {
    old = JSON.parse(before);
  } catch {
    continue;
  }
  if (JSON.stringify(old) === JSON.stringify(preset)) continue;
  const [version, oldVersion] = [field(preset, 'version'), field(old, 'version')];
  if (typeof version !== 'number' || typeof oldVersion !== 'number' || version <= oldVersion) {
    problems.push(`${path}: it changed since ${base}, so raise "version" above ${String(oldVersion)}`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
