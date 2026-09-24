/** Moves focus once React has applied the current change, for when the focused control is about to disappear. */
export function focusAfterRender(target: () => HTMLElement | null | undefined): void {
  requestAnimationFrame(() => {
    target()?.focus();
  });
}
