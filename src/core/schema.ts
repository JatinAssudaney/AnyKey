import { z } from 'zod';
import { parseKeys } from './keys';
import { parseMatchPattern } from './matchPattern';
import { isSafeUrl, MAX_URL_LENGTH } from './url';

// Schemas for every trust boundary: stored data, imported JSON, presets and runtime messages. Types are inferred
// from them. Code that runs on every page imports only types from here, which keeps zod out of the content script
// until it has data to validate.

export const LIMITS = { id: 100, label: 100, selector: 500, keys: 64 } as const;

export const KeyModeSchema = z.enum(['key', 'code']);
export type KeyMode = z.infer<typeof KeyModeSchema>;

export const ElementTargetSchema = z.object({
  /** CSS selector; " >>> " steps into an element's shadow root. */
  selector: z.string().min(1).max(LIMITS.selector),
  fallbacks: z.array(z.string().min(1).max(LIMITS.selector)).max(3).optional(),
  /** Visible text or aria-label, the last-resort match. */
  text: z.string().min(1).max(LIMITS.label).optional(),
  /** Restricts the text match to one element type, such as "button". */
  tag: z
    .string()
    .regex(/^[a-z][a-z\d-]*$/)
    .max(32)
    .optional(),
});
export type ElementTarget = z.infer<typeof ElementTargetSchema>;

export const ScrollDirectionSchema = z.enum(['up', 'down', 'halfUp', 'halfDown', 'top', 'bottom']);
export type ScrollDirection = z.infer<typeof ScrollDirectionSchema>;

export const TabOpSchema = z.enum(['next', 'prev', 'close', 'duplicate']);
export type TabOp = z.infer<typeof TabOpSchema>;

export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), target: ElementTargetSchema, newTab: z.boolean().optional() }),
  z.object({ type: z.literal('focus'), target: ElementTargetSchema }),
  z.object({ type: z.literal('scroll'), direction: ScrollDirectionSchema }),
  z.object({ type: z.literal('history'), op: z.enum(['back', 'forward']) }),
  z.object({
    type: z.literal('navigate'),
    url: z.string().max(MAX_URL_LENGTH).refine(isSafeUrl, 'Use an http(s) or relative URL.'),
    newTab: z.boolean().optional(),
  }),
  z.object({ type: z.literal('hints'), newTab: z.boolean().optional() }),
  z.object({ type: z.literal('tab'), op: TabOpSchema }),
  z.object({ type: z.literal('cheatsheet') }),
]);
export type Action = z.infer<typeof ActionSchema>;

export const ScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('global') }),
  z.object({
    type: z.literal('site'),
    match: z
      .string()
      .max(MAX_URL_LENGTH)
      .refine((pattern) => parseMatchPattern(pattern) !== null, 'Use a match pattern such as *://github.com/*.'),
  }),
]);
export type Scope = z.infer<typeof ScopeSchema>;

export const ShortcutSchema = z
  .object({
    /** "default:scroll-down", "preset:github:releases" or "user:<uuid>". */
    id: z.string().min(1).max(LIMITS.id),
    /** Notation parsed by `parseKeys`: "g i", "ctrl+shift+k", "mod+k", "?". */
    keys: z.string().min(1).max(LIMITS.keys),
    keyMode: KeyModeSchema,
    action: ActionSchema,
    scope: ScopeSchema,
    /** Shown in the cheatsheet and settings. */
    label: z.string().min(1).max(LIMITS.label),
    allowInInputs: z.boolean().optional(),
    source: z.enum(['default', 'preset', 'user']),
    /** Presets only: whether the preset shortcut was checked against the live site. */
    verified: z.boolean().optional(),
    enabled: z.boolean(),
  })
  .superRefine((shortcut, ctx) => {
    const parsed = parseKeys(shortcut.keys, shortcut.keyMode);
    if (!parsed.ok) ctx.addIssue({ code: 'custom', path: ['keys'], message: parsed.error });
  });
export type Shortcut = z.infer<typeof ShortcutSchema>;

export const SettingsSchema = z.object({
  /** How long a multi-key sequence waits for its next key. */
  sequenceTimeoutMs: z.number().int().min(200).max(5000),
  /** Pixels per scroll-up/down press. */
  scrollStep: z.number().int().min(10).max(1000),
  smoothScroll: z.boolean(),
  /** Characters used for link-hint labels. */
  hintChars: z
    .string()
    .min(2)
    .max(40)
    .refine((chars) => new Set(chars).size === chars.length, 'Use each hint character once.'),
  /** Links opened in a new tab (F hints, new-tab shortcuts) open behind the current tab. */
  newTabInBackground: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;
