import { z } from 'zod/mini';
import { canonicalKeys } from './keys';
import { matchesPattern, parseMatchPattern } from './matchPattern';
import {
  ActionSchema,
  IdSchema,
  KeyModeSchema,
  KeysSchema,
  LabelSchema,
  MatchPatternSchema,
  storedKeys,
  type Shortcut,
} from './schema';
import type { UrlParts } from './url';

// Presets: shortcuts AnyKey adds to popular sites, and the keys those sites use themselves (rules in
// docs/design.md, "Presets"). They are data: the background installs them in chrome.storage.local, and every
// context that reads them there checks them with these schemas first.

/** A preset's id, such as "github". Its shortcuts' ids start with "preset:<id>:". */
export const PresetIdSchema = z.string().check(z.regex(/^[a-z][a-z\d-]{0,39}$/));

/** Pages as Chrome match patterns: a preset's site, or the part of it an entry is narrowed to. */
const PagesSchema = z.array(MatchPatternSchema).check(z.minLength(1), z.maxLength(20));

/** A key the site uses itself. */
export const ReservedKeySchema = z
  .object({
    /** Key-mode notation in canonical form ("g c", "?", "mod+k"), so it compares with other keys as text. */
    keys: KeysSchema,
    /** What the key does on the site. */
    label: LabelSchema,
    /**
     * AnyKey's built-in shortcut on the same keys gives way to the site's on these pages, unless the user rekeyed
     * it or switched it back on for the site.
     */
    yield: z.optional(z.boolean()),
    /** Only on these pages of the site. */
    matches: z.optional(PagesSchema),
  })
  .check(
    z.superRefine((key, ctx) => {
      if (canonicalKeys(key.keys, 'key') !== key.keys) {
        ctx.addIssue({ code: 'custom', path: ['keys'], message: 'Write keys in canonical key-mode notation.' });
      }
    }),
  );
export type ReservedKey = z.infer<typeof ReservedKeySchema>;

/** A shortcut a preset adds to the site, for something the site has no key for. */
export const PresetShortcutSchema = z
  .object({
    /** "preset:<preset id>:<name>". The user's changes are keyed by it, so it stays the same across versions. */
    id: IdSchema,
    /** Canonical notation, as stored shortcuts have it. */
    keys: KeysSchema,
    keyMode: KeyModeSchema,
    action: ActionSchema,
    label: LabelSchema,
    allowInInputs: z.optional(z.boolean()),
    /** Whether it was checked on the live site with docs/preset-checklist.md. */
    verified: z.boolean(),
    /** Only on these pages of the site. */
    matches: z.optional(PagesSchema),
  })
  .check(
    z.superRefine((shortcut, ctx) => {
      if (canonicalKeys(shortcut.keys, shortcut.keyMode) !== shortcut.keys) {
        ctx.addIssue({ code: 'custom', path: ['keys'], message: 'Write keys in canonical notation.' });
      }
    }),
  );
export type PresetShortcut = z.infer<typeof PresetShortcutSchema>;

export const PresetSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: PresetIdSchema,
    /** The site's name as people know it: "GitHub". */
    name: z.string().check(z.minLength(1), z.maxLength(40)),
    /** Goes up with every change to the preset. */
    version: z.int().check(z.gte(1)),
    /** The site. */
    matches: PagesSchema,
    reserved: z.array(ReservedKeySchema).check(z.maxLength(300)),
    shortcuts: z.array(PresetShortcutSchema).check(z.maxLength(50)),
  })
  .check(
    z.superRefine((preset, ctx) => {
      const ids = new Set<string>();
      preset.shortcuts.forEach(({ id }, i) => {
        if (!id.startsWith(`preset:${preset.id}:`) || ids.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['shortcuts', i, 'id'],
            message: `Use an id of its own that starts with preset:${preset.id}:.`,
          });
        }
        ids.add(id);
      });
    }),
  );
export type Preset = z.infer<typeof PresetSchema>;

/** Where chrome.storage.local keeps the installed presets. */
export const PRESETS_KEY = 'presets';

/** Installed presets as stored, without any that fail their schema or repeat an earlier id. Never throws. */
export function parsePresets(value: unknown): Preset[] {
  if (!isList(value)) return [];
  const presets: Preset[] = [];
  for (const entry of value) {
    const result = PresetSchema.safeParse(entry);
    if (result.success && !presets.some(({ id }) => id === result.data.id)) presets.push(result.data);
  }
  return presets;
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * A user's change to a preset shortcut, kept in sync storage (`preset:<id>` docs). Keys come with their key mode,
 * so they can be checked without the preset.
 */
export const PresetOverrideSchema = z
  .object({
    keys: z.optional(KeysSchema),
    keyMode: z.optional(KeyModeSchema),
    enabled: z.optional(z.boolean()),
  })
  .check(
    z.superRefine((override, ctx) => {
      if (override.keys === undefined && override.keyMode === undefined) return;
      if (override.keys === undefined || override.keyMode === undefined) {
        ctx.addIssue({ code: 'custom', path: ['keys'], message: 'Keys and their key mode go together.' });
        return;
      }
      const stored = storedKeys(override.keys, override.keyMode);
      if (!stored.ok) ctx.addIssue({ code: 'custom', path: ['keys'], message: stored.error });
    }),
  );
export type PresetOverride = z.infer<typeof PresetOverrideSchema>;

/** Whether the page is among `matches`. No list means every page of the preset's site. */
export function covers(matches: readonly string[] | undefined, url: UrlParts): boolean {
  return matches === undefined || matches.some((pattern) => matchesPattern(pattern, url));
}

/** The hosts a preset's patterns name, such as "github.com": where the options page shows the preset. */
export function presetHosts(preset: Preset): string[] {
  const hosts = preset.matches.flatMap((pattern) => {
    const parsed = parseMatchPattern(pattern);
    return parsed?.kind === 'url' && parsed.host !== '*' && !parsed.subdomains ? [parsed.host] : [];
  });
  return [...new Set(hosts)];
}

/** A preset shortcut as the user has it: with their change applied, working on the preset's site. */
export function presetShortcut(preset: Preset, shortcut: PresetShortcut, override?: PresetOverride): Shortcut {
  return {
    id: shortcut.id,
    // An override's keys come with their key mode.
    keys: override?.keys ?? shortcut.keys,
    keyMode: override?.keyMode ?? shortcut.keyMode,
    action: shortcut.action,
    // The schema gives every preset a pattern.
    scope: { type: 'site', match: preset.matches[0] ?? '<all_urls>' },
    label: shortcut.label,
    ...(shortcut.allowInInputs === true ? { allowInInputs: true } : {}),
    source: 'preset',
    verified: shortcut.verified,
    enabled: override?.enabled ?? true,
  };
}

/**
 * The override that gives a preset shortcut the change, on top of the user's earlier one. Anything equal to the
 * preset's own value is left out, so storage stays sparse and a later version of the preset can improve it.
 */
export function presetOverride(
  shortcut: PresetShortcut,
  current: PresetOverride | undefined,
  change: { keys?: string; keyMode?: Shortcut['keyMode']; enabled?: boolean },
): PresetOverride {
  const keyMode = change.keyMode ?? current?.keyMode ?? shortcut.keyMode;
  const keys = change.keys ?? current?.keys ?? shortcut.keys;
  const canonical = canonicalKeys(keys, keyMode) ?? keys;
  const enabled = change.enabled ?? current?.enabled ?? true;
  return {
    ...(keyMode !== shortcut.keyMode || canonical !== shortcut.keys ? { keys: canonical, keyMode } : {}),
    ...(enabled ? {} : { enabled }),
  };
}
