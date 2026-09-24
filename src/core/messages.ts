import { z } from 'zod/mini';
import { PresetIdSchema, PresetOverrideSchema } from './presets';
import {
  ElementActionSchema,
  IdSchema,
  KeyModeSchema,
  KeysSchema,
  LabelSchema,
  SettingsSchema,
  ShortcutSchema,
  TabOpSchema,
} from './schema';
import { isHost, isHttpUrl, MAX_URL_LENGTH } from './url';

/** A site, as `URL.hostname` gives it: the host a site doc belongs to. */
export const HostSchema = z.string().check(z.refine(isHost, 'Enter a site such as github.com.'));

/**
 * Changes to stored settings. Extension pages send them to the background, which is the only writer (rules in
 * docs/design.md, "Storage"); the reducers in src/storage/mutations.ts apply them.
 */
export const MutationSchema = z.discriminatedUnion('op', [
  /** Settings to change. A setting equal to its default is removed from storage. */
  z.object({ op: z.literal('setSettings'), settings: z.partial(SettingsSchema) }),
  /** Rekeys a built-in shortcut, or turns it on or off. Fields left out keep their current value. */
  z.object({
    op: z.literal('setDefault'),
    id: IdSchema,
    keys: z.optional(KeysSchema),
    keyMode: z.optional(KeyModeSchema),
    enabled: z.optional(z.boolean()),
  }),
  /** Puts a built-in shortcut back to its original keys, turned on. */
  z.object({ op: z.literal('resetDefault'), id: IdSchema }),
  /**
   * Adds a user shortcut, or replaces the one with the same id. `site` names the site whose doc keeps a site
   * shortcut (a global shortcut has none), and the shortcut moves there from whichever doc kept it before.
   */
  z.object({ op: z.literal('saveShortcut'), shortcut: ShortcutSchema, site: z.optional(HostSchema) }),
  /** Deletes a user shortcut from whichever doc keeps it. */
  z.object({ op: z.literal('deleteShortcut'), id: IdSchema }),
  /** Switches AnyKey off, or back on, for one site. */
  z.object({ op: z.literal('setSiteDisabled'), site: HostSchema, disabled: z.boolean() }),
  /**
   * Turns a built-in shortcut on or off for one site, whatever applies everywhere else and whatever a preset says.
   * Leaving `enabled` out removes the site's own switch.
   */
  z.object({ op: z.literal('setSiteDefault'), site: HostSchema, id: IdSchema, enabled: z.optional(z.boolean()) }),
  /** Replaces the user's change to a preset shortcut. An empty override puts back the preset's own keys, turned on. */
  z.object({ op: z.literal('setPresetOverride'), preset: PresetIdSchema, id: IdSchema, override: PresetOverrideSchema }),
  /**
   * Puts a site back the way its preset has it: no changes to the preset's shortcuts, and no site switches for
   * built-in shortcuts. `deleteShortcuts` also deletes the user's shortcuts kept with the site.
   */
  z.object({ op: z.literal('resetToPreset'), preset: PresetIdSchema, site: HostSchema, deleteShortcuts: z.boolean() }),
  /** Replaces every doc this version knows with the given items (an import). The old data becomes the backup. */
  z.object({ op: z.literal('replaceAll'), items: z.record(z.string(), z.unknown()) }),
  /** Swaps the stored data with the backup. */
  z.object({ op: z.literal('restoreBackup') }),
  /** Rewrites a partly readable doc with only what this version can read. */
  z.object({ op: z.literal('repairDoc'), key: z.string().check(z.maxLength(300)) }),
]);
export type Mutation = z.infer<typeof MutationSchema>;

/** What the picker makes. The background adds the rest: an id, and the page's site as the scope. */
export const PickedShortcutSchema = z.object({
  keys: KeysSchema,
  keyMode: KeyModeSchema,
  action: ElementActionSchema,
  label: LabelSchema,
  allowInInputs: z.optional(z.boolean()),
});
export type PickedShortcut = z.infer<typeof PickedShortcutSchema>;

/** Requests to the background. The background validates each one with this schema. */
export const BackgroundMessageSchema = z.discriminatedUnion('type', [
  /** From a page: switch, close or duplicate the sender's tab. */
  z.object({ type: z.literal('tab'), op: TabOpSchema }),
  z.object({
    type: z.literal('openUrl'),
    /** Absolute: the content script resolves relative URLs against the page first. */
    url: z.string().check(z.maxLength(MAX_URL_LENGTH), z.refine(isHttpUrl, 'Only http(s) URLs can be opened.')),
    background: z.boolean(),
  }),
  /** From AnyKey's own pages only. */
  z.object({ type: z.literal('mutate'), mutation: MutationSchema }),
  /** From the popup: starts the element picker in a tab, for the site the popup showed. */
  z.object({ type: z.literal('startPicker'), tabId: z.int().check(z.gte(0)), host: HostSchema }),
  /** From the picker in a page: saves what it made as a shortcut for the page's own site. */
  z.object({ type: z.literal('addSiteShortcut'), shortcut: PickedShortcutSchema }),
  /** From the picker in a page: it closed without saving. */
  z.object({ type: z.literal('pickerDone') }),
]);
export type BackgroundMessage = z.infer<typeof BackgroundMessageSchema>;

export type BackgroundResponse = { ok: true } | { ok: false; error: string };

/**
 * Requests to the content script in a tab's top frame, from the popup and the background. `ping` asks only whether
 * AnyKey is running there, so the background learns nothing about the page.
 */
export type PageRequest = { type: 'pageInfo' } | { type: 'startPicker' } | { type: 'ping' };

/** The answer to `pageInfo`. */
export interface PageInfo {
  ok: true;
  /** The page's URL without its # part. */
  url: string;
}
