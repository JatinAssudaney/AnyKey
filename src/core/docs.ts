import { z } from 'zod/mini';
import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS } from './defaults';
import { PresetIdSchema, PresetOverrideSchema, type PresetOverride } from './presets';
import {
  IdSchema,
  KeyModeSchema,
  KeysSchema,
  SettingsSchema,
  ShortcutSchema,
  storedKeys,
  type Settings,
  type Shortcut,
} from './schema';
import { isHost } from './url';

// The docs AnyKey keeps in chrome.storage.sync (rules in docs/design.md, "Storage"), and a tolerant reader for them:
// a doc saved by a newer version, or damaged, still yields every entry this version can read.

/** Carried by every stored doc as `v`. Bump it with any change to a stored format. */
export const DOC_VERSION = 1;

export const SETTINGS_KEY = 'settings';
export const GLOBAL_KEY = 'global';
const SITE_PREFIX = 'site:';
const PRESET_PREFIX = 'preset:';

/** chrome.storage.sync quotas. An item's size is the UTF-8 bytes of its key plus its JSON value. */
export const SYNC_QUOTA = { totalBytes: 102_400, itemBytes: 8_192, items: 512 } as const;

export function siteKey(host: string): string {
  return SITE_PREFIX + host;
}

/** The host a `site:<host>` key belongs to, or null for other keys. */
export function hostOfKey(key: string): string | null {
  return key.startsWith(SITE_PREFIX) ? key.slice(SITE_PREFIX.length) : null;
}

export function presetKey(id: string): string {
  return PRESET_PREFIX + id;
}

/** The preset a `preset:<id>` key belongs to, or null for other keys. */
export function presetOfKey(key: string): string | null {
  return key.startsWith(PRESET_PREFIX) ? key.slice(PRESET_PREFIX.length) : null;
}

/** Keys of the docs this version reads and writes. Other keys in storage are left alone. */
export function isKnownKey(key: string): boolean {
  return key === SETTINGS_KEY || key === GLOBAL_KEY || key.startsWith(SITE_PREFIX) || key.startsWith(PRESET_PREFIX);
}

/** A user's change to a built-in shortcut. Fields left out keep the built-in value. */
export const DefaultOverrideSchema = z.object({
  keys: z.optional(KeysSchema),
  keyMode: z.optional(KeyModeSchema),
  enabled: z.optional(z.boolean()),
});
export type DefaultOverride = z.infer<typeof DefaultOverrideSchema>;

export interface GlobalState {
  /** The user's own global shortcuts, in the order they were added. */
  shortcuts: readonly Shortcut[];
  /** Changes to built-in shortcuts, by default id. */
  overrides: ReadonlyMap<string, DefaultOverride>;
}

export interface SiteState {
  /** AnyKey is switched off on this host. */
  disabled: boolean;
  shortcuts: readonly Shortcut[];
  /** Built-in shortcuts switched on or off on this host, by default id. */
  globals: ReadonlyMap<string, boolean>;
}

export interface SyncState {
  /** Only the settings the user changed; `effectiveSettings` adds the defaults. */
  settings: Partial<Settings>;
  global: GlobalState;
  /** By exact host, as `URL.hostname` gives it. */
  sites: ReadonlyMap<string, SiteState>;
  /** The user's changes to preset shortcuts, by preset id, then by preset shortcut id. */
  presets: ReadonlyMap<string, ReadonlyMap<string, PresetOverride>>;
}

/** Why a doc is only partly readable: saved by a newer version, or damaged. */
export type Problem = 'newer' | 'invalid';

export interface SyncData {
  state: SyncState;
  /**
   * Docs this version reads only partly, by key. Their readable entries still work, but only a repair or an import
   * may write them, so data from a newer version is never lost by accident.
   */
  problems: ReadonlyMap<string, Problem>;
  /** Every stored item as read, including keys this version doesn't know: for export and size checks. */
  items: Readonly<Record<string, unknown>>;
}

export const EMPTY_STATE: SyncState = {
  settings: {},
  global: { shortcuts: [], overrides: new Map() },
  sites: new Map(),
  presets: new Map(),
};

export function effectiveSettings(state: SyncState): Settings {
  return { ...DEFAULT_SETTINGS, ...state.settings };
}

type Report = (problem: Problem) => void;

/** Reads raw `chrome.storage.sync` items. Never throws: unreadable entries are skipped and reported. */
export function parseSync(items: Readonly<Record<string, unknown>>): SyncData {
  const problems = new Map<string, Problem>();
  const reporter =
    (key: string): Report =>
    (problem) => {
      // A newer doc usually fails this version's checks too; "newer" is the better explanation.
      if (problems.get(key) !== 'newer') problems.set(key, problem);
    };

  const sites = new Map<string, SiteState>();
  const presets = new Map<string, ReadonlyMap<string, PresetOverride>>();
  for (const [key, value] of Object.entries(items)) {
    const host = hostOfKey(key);
    const preset = presetOfKey(key);
    if (host !== null) {
      if (isHost(host)) sites.set(host, parseSite(value, reporter(key)));
      else problems.set(key, 'invalid');
    } else if (preset !== null) {
      if (PresetIdSchema.safeParse(preset).success) presets.set(preset, parsePresetDoc(preset, value, reporter(key)));
      else problems.set(key, 'invalid');
    }
  }
  const state: SyncState = {
    settings: parseSettings(items[SETTINGS_KEY], reporter(SETTINGS_KEY)),
    global: parseGlobal(items[GLOBAL_KEY], reporter(GLOBAL_KEY)),
    sites,
    presets,
  };
  return { state, problems, items };
}

/** The doc's fields, or null when there is no doc. Reports a missing, bad or newer `v`. */
function openDoc(value: unknown, report: Report): Readonly<Record<string, unknown>> | null {
  if (value === undefined) return null;
  if (!isRecord(value)) {
    report('invalid');
    return null;
  }
  const version = value.v;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) report('invalid');
  else if (version > DOC_VERSION) report('newer');
  return value;
}

const PartialSettingsSchema = z.partial(SettingsSchema);
const SETTING_NAMES = Object.keys(DEFAULT_SETTINGS);

function parseSettings(value: unknown, report: Report): Partial<Settings> {
  const doc = openDoc(value, report);
  const settings: Partial<Settings> = {};
  if (doc === null) return settings;
  for (const name of SETTING_NAMES) {
    if (doc[name] === undefined) continue;
    // One field at a time, so a bad value costs only that setting.
    const result = PartialSettingsSchema.safeParse({ [name]: doc[name] });
    if (result.success) Object.assign(settings, result.data);
    else report('invalid');
  }
  return settings;
}

const DEFAULTS_BY_ID = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

function parseGlobal(value: unknown, report: Report): GlobalState {
  const doc = openDoc(value, report);
  if (doc === null) return EMPTY_STATE.global;
  const overrides = parseEntries(doc.overrides, DefaultOverrideSchema, report);
  for (const [id, override] of overrides) {
    // An override of a built-in shortcut this version lacks stays as it is, for the version that has it.
    const base = DEFAULTS_BY_ID.get(id);
    if (base !== undefined && !storedKeys(override.keys ?? base.keys, override.keyMode ?? base.keyMode).ok) {
      overrides.delete(id);
      report('invalid');
    }
  }
  return { shortcuts: parseShortcuts(doc.shortcuts, 'global', report), overrides };
}

const SiteGlobalSchema = z.object({ enabled: z.boolean() });

function parseSite(value: unknown, report: Report): SiteState {
  const doc = openDoc(value, report) ?? {};
  const disabled = doc.disabled;
  if (disabled !== undefined && typeof disabled !== 'boolean') report('invalid');
  const globals = new Map<string, boolean>();
  for (const [id, entry] of parseEntries(doc.globals, SiteGlobalSchema, report)) globals.set(id, entry.enabled);
  return { disabled: disabled === true, shortcuts: parseShortcuts(doc.shortcuts, 'site', report), globals };
}

/** Changes to one preset's shortcuts. An entry for a shortcut of another preset counts as damage. */
function parsePresetDoc(preset: string, value: unknown, report: Report): Map<string, PresetOverride> {
  const doc = openDoc(value, report) ?? {};
  const overrides = parseEntries(doc.overrides, PresetOverrideSchema, report);
  for (const id of overrides.keys()) {
    if (id.startsWith(`preset:${preset}:`)) continue;
    overrides.delete(id);
    report('invalid');
  }
  return overrides;
}

/** User shortcuts of one scope type. Anything else, and repeated ids, count as damage. */
function parseShortcuts(value: unknown, scope: 'global' | 'site', report: Report): Shortcut[] {
  if (value === undefined) return [];
  if (!isArray(value)) {
    report('invalid');
    return [];
  }
  const shortcuts: Shortcut[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const result = ShortcutSchema.safeParse(entry);
    if (result.success && result.data.source === 'user' && result.data.scope.type === scope && !ids.has(result.data.id)) {
      ids.add(result.data.id);
      shortcuts.push(result.data);
    } else {
      report('invalid');
    }
  }
  return shortcuts;
}

interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

/** An object of entries keyed by shortcut id, as a Map: stored keys never become object keys here. */
function parseEntries<T>(value: unknown, parser: Parser<T>, report: Report): Map<string, T> {
  const entries = new Map<string, T>();
  if (value === undefined) return entries;
  if (!isRecord(value)) {
    report('invalid');
    return entries;
  }
  for (const [id, entry] of Object.entries(value)) {
    const result = parser.safeParse(entry);
    if (result.success && IdSchema.safeParse(id).success) entries.set(id, result.data);
    else report('invalid');
  }
  return entries;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** The stored form of the doc at `key`, or undefined when it holds nothing and the key should be removed. */
export function serializeDoc(state: SyncState, key: string): object | undefined {
  if (key === SETTINGS_KEY) {
    return Object.keys(state.settings).length === 0 ? undefined : { v: DOC_VERSION, ...state.settings };
  }
  if (key === GLOBAL_KEY) {
    const { shortcuts, overrides } = state.global;
    if (shortcuts.length === 0 && overrides.size === 0) return undefined;
    return { v: DOC_VERSION, shortcuts, overrides: Object.fromEntries(overrides) };
  }
  const preset = presetOfKey(key);
  if (preset !== null) {
    const overrides = state.presets.get(preset);
    return overrides === undefined || overrides.size === 0
      ? undefined
      : { v: DOC_VERSION, overrides: Object.fromEntries(overrides) };
  }
  const host = hostOfKey(key);
  const site = host === null ? undefined : state.sites.get(host);
  if (site === undefined || (!site.disabled && site.shortcuts.length === 0 && site.globals.size === 0)) return undefined;
  const globals = Object.fromEntries([...site.globals].map(([id, enabled]) => [id, { enabled }]));
  return {
    v: DOC_VERSION,
    ...(site.disabled ? { disabled: true } : {}),
    shortcuts: site.shortcuts,
    ...(site.globals.size > 0 ? { globals } : {}),
  };
}

/**
 * What an item counts against the sync quotas: the UTF-8 bytes of its key plus its value as Chrome's JSON writer
 * writes it. That writer escapes "<", U+2028 and U+2029 as six-character \u escapes, which JSON.stringify doesn't.
 */
export function itemBytes(key: string, value: unknown): number {
  return utf8Length(key, false) + utf8Length(JSON.stringify(value), true);
}

function utf8Length(text: string, json: boolean): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (json && (code === 0x3c || code === 0x2028 || code === 0x2029)) bytes += 6;
    else bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** An export file: every sync item, as stored. */
export const EXPORT_FORMAT = 'anykey-settings';
export const EXPORT_VERSION = 1;

export const ExportFileSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.int().check(z.gte(1)),
  exportedAt: z.optional(z.string()),
  items: z.record(z.string(), z.unknown()),
});
export type ExportFile = z.infer<typeof ExportFileSchema>;

/** The sync data as it was before the last import or restore, kept in chrome.storage.local. */
export const BACKUP_KEY = 'backup';

export const BackupSchema = z.object({
  /** Milliseconds since the epoch. */
  savedAt: z.number(),
  items: z.record(z.string(), z.unknown()),
});
export type Backup = z.infer<typeof BackupSchema>;
