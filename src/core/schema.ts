import { z } from 'zod/mini';
import { chordText, parseKeys } from './keys';
import { parseMatchPattern } from './matchPattern';
import { isSafeUrl, MAX_URL_LENGTH } from './url';

// Schemas for every trust boundary: stored data, imported JSON, presets and runtime messages. Types are inferred
// from them. They use zod/mini, whose functions tree-shake: the content script validates stored shortcuts on every
// page, and classic zod would add about 85 kB to it. zod/mini ships no English messages, so every check a user can
// fail in the options page carries its own.

export const LIMITS = { id: 100, label: 100, selector: 500, keys: 64 } as const;

/** A non-empty string of at most `max` characters. */
function bounded(max: number, emptyMessage?: string) {
  return z.string().check(z.minLength(1, emptyMessage), z.maxLength(max));
}

export const IdSchema = bounded(LIMITS.id);

/** A shortcut's name, shown in the cheatsheet and settings. */
export const LabelSchema = bounded(LIMITS.label, 'Enter a name.');

/** Shortcut notation. `parseKeys` checks the content, so an empty string gets its message ("Enter a key."). */
export const KeysSchema = z.string().check(z.maxLength(LIMITS.keys, `Use at most ${LIMITS.keys} characters.`));

export const KeyModeSchema = z.enum(['key', 'code']);
export type KeyMode = z.infer<typeof KeyModeSchema>;

/**
 * Keys as AnyKey stores them: in canonical notation (`meta+pagedown` for `cmd+pgdn`), which must fit the length limit
 * too. Writers store this form and the reader checks it, so a saved shortcut always reads back.
 */
export function storedKeys(keys: string, keyMode: KeyMode): { ok: true; keys: string } | { ok: false; error: string } {
  const parsed = parseKeys(keys, keyMode);
  if (!parsed.ok) return parsed;
  const text = parsed.chords.map(chordText).join(' ');
  if (text.length > LIMITS.keys) return { ok: false, error: 'These keys are too long to save. Use fewer keys.' };
  return { ok: true, keys: text };
}

export const ElementTargetSchema = z.object({
  /** CSS selector; " >>> " steps into an element's shadow root. */
  selector: bounded(LIMITS.selector),
  fallbacks: z.optional(z.array(bounded(LIMITS.selector)).check(z.maxLength(3))),
  /** Visible text or aria-label, the last-resort match. */
  text: z.optional(bounded(LIMITS.label)),
  /** Restricts the text match to one element type, such as "button". */
  tag: z.optional(z.string().check(z.maxLength(32), z.regex(/^[a-z][a-z\d-]*$/))),
});
export type ElementTarget = z.infer<typeof ElementTargetSchema>;

export const ScrollDirectionSchema = z.enum(['up', 'down', 'halfUp', 'halfDown', 'top', 'bottom']);
export type ScrollDirection = z.infer<typeof ScrollDirectionSchema>;

export const TabOpSchema = z.enum(['next', 'prev', 'close', 'duplicate']);
export type TabOp = z.infer<typeof TabOpSchema>;

/** Clicks an element. `newTab` opens a link in a new tab instead. */
export const ClickActionSchema = z.object({
  type: z.literal('click'),
  target: ElementTargetSchema,
  newTab: z.optional(z.boolean()),
});

/** Focuses an element, with the caret at the end of a text field. */
export const FocusActionSchema = z.object({ type: z.literal('focus'), target: ElementTargetSchema });

/** The actions the picker makes: they act on one element of the page. */
export const ElementActionSchema = z.discriminatedUnion('type', [ClickActionSchema, FocusActionSchema]);
export type ElementAction = z.infer<typeof ElementActionSchema>;

export const ActionSchema = z.discriminatedUnion('type', [
  ClickActionSchema,
  FocusActionSchema,
  z.object({ type: z.literal('scroll'), direction: ScrollDirectionSchema }),
  z.object({ type: z.literal('history'), op: z.enum(['back', 'forward']) }),
  z.object({
    type: z.literal('navigate'),
    url: z
      .string()
      .check(
        z.maxLength(MAX_URL_LENGTH, 'Use a shorter URL.'),
        z.refine(isSafeUrl, 'Use a web address starting with https://, or a path such as /notifications.'),
      ),
    newTab: z.optional(z.boolean()),
  }),
  z.object({ type: z.literal('hints'), newTab: z.optional(z.boolean()) }),
  z.object({ type: z.literal('tab'), op: TabOpSchema }),
  z.object({ type: z.literal('cheatsheet') }),
]);
export type Action = z.infer<typeof ActionSchema>;

/** A Chrome match pattern, such as `*://github.com/*`. */
export const MatchPatternSchema = z
  .string()
  .check(
    z.maxLength(MAX_URL_LENGTH),
    z.refine((pattern) => parseMatchPattern(pattern) !== null, 'Use a match pattern such as *://github.com/*.'),
  );

export const ScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('global') }),
  z.object({ type: z.literal('site'), match: MatchPatternSchema }),
]);
export type Scope = z.infer<typeof ScopeSchema>;

export const ShortcutSchema = z
  .object({
    /** "default:scroll-down", "preset:github:releases" or "user:<uuid>". */
    id: IdSchema,
    /** Notation parsed by `parseKeys`: "g i", "ctrl+shift+k", "mod+k", "?". */
    keys: KeysSchema,
    keyMode: KeyModeSchema,
    action: ActionSchema,
    scope: ScopeSchema,
    label: LabelSchema,
    allowInInputs: z.optional(z.boolean()),
    source: z.enum(['default', 'preset', 'user']),
    /** Presets only: whether the preset shortcut was checked against the live site. */
    verified: z.optional(z.boolean()),
    enabled: z.boolean(),
  })
  .check(
    z.superRefine((shortcut, ctx) => {
      const stored = storedKeys(shortcut.keys, shortcut.keyMode);
      if (!stored.ok) ctx.addIssue({ code: 'custom', path: ['keys'], message: stored.error });
    }),
  );
export type Shortcut = z.infer<typeof ShortcutSchema>;

/** A whole number from `min` to `max`. */
function between(min: number, max: number) {
  const message = `Use a whole number from ${min} to ${max}.`;
  return z.int(message).check(z.gte(min, message), z.lte(max, message));
}

export const SettingsSchema = z.object({
  /** How long a multi-key sequence waits for its next key. */
  sequenceTimeoutMs: between(200, 5000),
  /** Pixels per scroll-up/down press. */
  scrollStep: between(10, 1000),
  smoothScroll: z.boolean(),
  /** Characters link hint labels are made of, the most comfortable first. Hints ignore case. */
  hintChars: z
    .string()
    .check(
      z.refine((chars) => Array.from(chars).length >= 2, 'Use at least 2 characters.'),
      z.maxLength(40, 'Use at most 40 characters.'),
      z.refine((chars) => !/\s/u.test(chars), 'Leave out spaces.'),
      z.refine((chars) => {
        const list = Array.from(chars.toLowerCase());
        return new Set(list).size === list.length;
      }, 'Use each character once. Capital and small letters count as the same.'),
    ),
  /** Links opened in a new tab (F hints, new-tab shortcuts) open behind the current tab. */
  newTabInBackground: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;
