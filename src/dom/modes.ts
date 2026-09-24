/**
 * What happens to a keydown handled by a UI mode. "consume" stops it and cancels its default action. "isolate"
 * only stops it reaching the page, so its default action still happens: Tab moves focus, Enter presses a button,
 * characters type into AnyKey's own fields.
 */
export type Disposition = 'consume' | 'isolate';

/** A UI that takes over the keyboard while open: the cheatsheet, the picker and link hints. */
export interface Mode {
  /** `token` is the key-mode match token (see `keyToken`), or null for keys that have none. */
  keyDown(event: KeyboardEvent, token: string | null): Disposition;
  /**
   * Pointer, mouse and click events anywhere in the page, before any page script sees them. The mode may stop
   * them; AnyKey's own UI gets them as usual unless it does.
   */
  pointer?(event: MouseEvent): void;
  /**
   * Text changed in one of AnyKey's fields (typing, pasting, an input method). The engine keeps these events from
   * the page, and from AnyKey's own elements too, so modes hear of them here.
   */
  uiInput?(): void;
}
