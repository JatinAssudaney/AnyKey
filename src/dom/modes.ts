/**
 * What happens to a keydown handled by a UI mode. "consume" stops it and cancels its default action. "isolate"
 * only stops it reaching the page, so its default action still happens: Tab moves focus, Enter presses a button,
 * characters type into AnyKey's own fields.
 */
export type Disposition = 'consume' | 'isolate';

/** A UI that takes over the keyboard while open, such as the cheatsheet (later: hints, the picker). */
export interface Mode {
  /** `token` is the key-mode match token (see `keyToken`), or null for keys that have none. */
  keyDown(event: KeyboardEvent, token: string | null): Disposition;
}
