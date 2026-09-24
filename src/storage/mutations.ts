import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS } from '../core/defaults';
import {
  GLOBAL_KEY,
  hostOfKey,
  isKnownKey,
  itemBytes,
  parseSync,
  serializeDoc,
  SETTINGS_KEY,
  siteKey,
  SYNC_QUOTA,
  type DefaultOverride,
  type Problem,
  type SyncData,
  type SyncState,
} from '../core/docs';
import type { Mutation } from '../core/messages';
import { storedKeys, type KeyMode, type Settings, type Shortcut } from '../core/schema';

export type MutationResult =
  | { ok: true; data: SyncData; touched: readonly string[] }
  | { ok: false; error: string };

const DEFAULTS_BY_ID = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

/**
 * Applies one mutation (rules in docs/design.md, "Storage"). Pure: the background writer saves with it, and the
 * options page shows a change with it before the change is saved. `touched` lists the sync keys to write. Docs
 * with a problem are refused, except by a repair or a replace, and every result fits the sync quotas and reads
 * back whole.
 */
export function applyMutation(data: SyncData, mutation: Mutation): MutationResult {
  const { state } = data;
  switch (mutation.op) {
    case 'setSettings': {
      const settings = withoutDefaults({ ...state.settings, ...mutation.settings });
      return commit(data, { ...state, settings }, [SETTINGS_KEY]);
    }
    case 'setDefault':
      return setDefault(data, mutation);
    case 'resetDefault':
      if (!DEFAULTS_BY_ID.has(mutation.id)) return fail(unknownDefault(mutation.id));
      return commitOverrides(data, withEntry(state.global.overrides, mutation.id, undefined));
    case 'saveShortcut':
      return saveShortcut(data, mutation.shortcut);
    case 'deleteShortcut': {
      const shortcuts = state.global.shortcuts.filter((shortcut) => shortcut.id !== mutation.id);
      if (shortcuts.length === state.global.shortcuts.length) return { ok: true, data, touched: [] };
      return commit(data, { ...state, global: { ...state.global, shortcuts } }, [GLOBAL_KEY]);
    }
    case 'replaceAll':
      return replaceAll(data, mutation.items);
    case 'restoreBackup':
      // The writer restores with `restoreItems`, since the backup lives in storage.local.
      return fail('Only the background can restore the backup.');
    case 'repairDoc':
      if (!data.problems.has(mutation.key)) return fail('That part of your settings needs no repair.');
      // The state holds only what this version could read, so writing it back drops the rest.
      return commit(data, state, [mutation.key], { force: true });
  }
}

function setDefault(data: SyncData, change: Extract<Mutation, { op: 'setDefault' }>): MutationResult {
  const base = DEFAULTS_BY_ID.get(change.id);
  if (base === undefined) return fail(unknownDefault(change.id));
  const current = data.state.global.overrides.get(change.id) ?? {};
  const keyMode: KeyMode = change.keyMode ?? current.keyMode ?? base.keyMode;
  const stored = storedKeys(change.keys ?? current.keys ?? base.keys, keyMode);
  if (!stored.ok) return fail(stored.error);
  const { keys } = stored;
  const enabled = change.enabled ?? current.enabled ?? base.enabled;

  // Store only what differs from the built-in shortcut, so a later version can improve the defaults.
  const override: DefaultOverride = {};
  if (keyMode !== base.keyMode) override.keyMode = keyMode;
  if (keyMode !== base.keyMode || keys !== base.keys) override.keys = keys;
  if (enabled !== base.enabled) override.enabled = enabled;
  const empty = Object.keys(override).length === 0;
  return commitOverrides(data, withEntry(data.state.global.overrides, change.id, empty ? undefined : override));
}

function saveShortcut(data: SyncData, shortcut: Shortcut): MutationResult {
  if (shortcut.source !== 'user' || !shortcut.id.startsWith('user:')) {
    return fail('Only your own shortcuts can be saved this way.');
  }
  if (shortcut.scope.type !== 'global') return fail('This version of AnyKey saves global shortcuts only.');
  const stored = storedKeys(shortcut.keys, shortcut.keyMode);
  if (!stored.ok) return fail(stored.error);
  const label = shortcut.label.trim();
  if (label === '') return fail('Enter a name.');

  const saved: Shortcut = { ...shortcut, keys: stored.keys, label };
  const list = data.state.global.shortcuts;
  const shortcuts = list.some((s) => s.id === saved.id)
    ? list.map((s) => (s.id === saved.id ? saved : s))
    : [...list, saved];
  return commit(data, { ...data.state, global: { ...data.state.global, shortcuts } }, [GLOBAL_KEY]);
}

/** Every doc this version knows is replaced; entries the new items can't provide are dropped. */
function replaceAll(data: SyncData, items: Readonly<Record<string, unknown>>): MutationResult {
  const incoming = parseSync(items).state;
  const touched = new Set([SETTINGS_KEY, GLOBAL_KEY]);
  for (const key of Object.keys(data.items)) if (isKnownKey(key)) touched.add(key);
  for (const host of incoming.sites.keys()) touched.add(siteKey(host));
  return commit(data, incoming, [...touched], { force: true });
}

function commitOverrides(data: SyncData, overrides: ReadonlyMap<string, DefaultOverride>): MutationResult {
  return commit(data, { ...data.state, global: { ...data.state.global, overrides } }, [GLOBAL_KEY]);
}

function commit(
  data: SyncData,
  state: SyncState,
  touched: readonly string[],
  options: { force: boolean } = { force: false },
): MutationResult {
  if (!options.force) {
    for (const key of touched) {
      const problem = data.problems.get(key);
      if (problem !== undefined) return fail(problemMessage(key, problem));
    }
  }
  // fromEntries defines own properties, so even a stored "__proto__" key stays an ordinary item.
  const items: Readonly<Record<string, unknown>> = Object.fromEntries([
    ...Object.entries(data.items).filter(([key]) => !touched.includes(key)),
    ...touched.flatMap((key) => {
      const doc = serializeDoc(state, key);
      return doc === undefined ? [] : [[key, doc] as const];
    }),
  ]);
  const quotaError = checkQuota(items, touched);
  if (quotaError !== null) return fail(quotaError);
  // A doc the reader can't take back whole would be locked as damaged, so nothing is written that way.
  const written = Object.fromEntries(touched.filter((key) => Object.hasOwn(items, key)).map((key) => [key, items[key]]));
  const [damaged] = parseSync(written).problems.keys();
  if (damaged !== undefined) return fail(`This change would damage ${docName(damaged)}, so AnyKey didn't save it.`);
  const problems = new Map([...data.problems].filter(([key]) => !touched.includes(key)));
  return { ok: true, data: { state, problems, items }, touched };
}

/**
 * Restores the backup (the writer's part of `restoreBackup`, since the backup lives in storage.local). Its docs go
 * back exactly as they were, even what this version can't read, so a restore undoes an import completely.
 */
export function restoreItems(data: SyncData, items: Readonly<Record<string, unknown>>): MutationResult {
  const touched = [...new Set([...Object.keys(data.items), ...Object.keys(items)].filter(isKnownKey))];
  // fromEntries defines own properties, so even a stored "__proto__" key stays an ordinary item.
  const restored: Readonly<Record<string, unknown>> = Object.fromEntries([
    ...Object.entries(data.items).filter(([key]) => !isKnownKey(key)),
    ...Object.entries(items).filter(([key]) => isKnownKey(key)),
  ]);
  const quotaError = checkQuota(restored, touched);
  if (quotaError !== null) return fail(quotaError);
  return { ok: true, data: parseSync(restored), touched };
}

function checkQuota(items: Readonly<Record<string, unknown>>, touched: readonly string[]): string | null {
  for (const key of touched) {
    if (Object.hasOwn(items, key) && itemBytes(key, items[key]) > SYNC_QUOTA.itemBytes) {
      return `${capitalized(docName(key))} can use at most 8 KB of synced storage, and this change would pass that. Delete a shortcut first.`;
    }
  }
  const total = Object.entries(items).reduce((sum, [key, value]) => sum + itemBytes(key, value), 0);
  if (total > SYNC_QUOTA.totalBytes) {
    return 'AnyKey can use at most 100 KB of synced storage, and this change would pass that. Delete some shortcuts first.';
  }
  if (Object.keys(items).length > SYNC_QUOTA.items) {
    return 'AnyKey can keep settings for at most 500 sites. Remove some sites first.';
  }
  return null;
}

/** Settings equal to their default are left out of storage, so a later version can change the default. */
function withoutDefaults(settings: Partial<Settings>): Partial<Settings> {
  const kept: Partial<Settings> = {};
  for (const name of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = settings[name];
    if (value !== undefined && value !== DEFAULT_SETTINGS[name]) Object.assign(kept, { [name]: value });
  }
  return kept;
}

function withEntry<T>(map: ReadonlyMap<string, T>, key: string, value: T | undefined): ReadonlyMap<string, T> {
  const next = new Map(map);
  if (value === undefined) next.delete(key);
  else next.set(key, value);
  return next;
}

/** How the options page names a stored doc, mid-sentence: "your global shortcuts". */
export function docName(key: string): string {
  if (key === SETTINGS_KEY) return 'your settings';
  if (key === GLOBAL_KEY) return 'your global shortcuts';
  const host = hostOfKey(key);
  return host === null ? `"${key}"` : `your shortcuts for ${host}`;
}

export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function problemMessage(key: string, problem: Problem): string {
  const name = capitalized(docName(key));
  return problem === 'newer'
    ? `${name} were saved by a newer version of AnyKey, so this version won't change them. Update AnyKey, or repair them under "Your data".`
    : `${name} are partly damaged, so AnyKey won't change them until you repair them under "Your data".`;
}

function unknownDefault(id: string): string {
  return `AnyKey has no built-in shortcut "${id}".`;
}

function fail(error: string): MutationResult {
  return { ok: false, error };
}
