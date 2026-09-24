import { z } from 'zod/mini';
import { IdSchema, KeyModeSchema, KeysSchema, SettingsSchema, ShortcutSchema, TabOpSchema } from './schema';
import { isHttpUrl, MAX_URL_LENGTH } from './url';

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
  /** Adds a user shortcut, or replaces the one with the same id. */
  z.object({ op: z.literal('saveShortcut'), shortcut: ShortcutSchema }),
  z.object({ op: z.literal('deleteShortcut'), id: IdSchema }),
  /** Replaces every doc this version knows with the given items (an import). The old data becomes the backup. */
  z.object({ op: z.literal('replaceAll'), items: z.record(z.string(), z.unknown()) }),
  /** Swaps the stored data with the backup. */
  z.object({ op: z.literal('restoreBackup') }),
  /** Rewrites a partly readable doc with only what this version can read. */
  z.object({ op: z.literal('repairDoc'), key: z.string().check(z.maxLength(300)) }),
]);
export type Mutation = z.infer<typeof MutationSchema>;

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
]);
export type BackgroundMessage = z.infer<typeof BackgroundMessageSchema>;

export type BackgroundResponse = { ok: true } | { ok: false; error: string };
