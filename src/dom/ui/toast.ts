import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { h } from './h';
import type { UiRoot } from './root';

const VISIBLE_MS = 4000;

export type ShowToast = (message: string) => void;

/** A short status message at the bottom of the page, in the top layer so page modals can't cover it. */
export function createToast(root: UiRoot, ctx: ContentScriptContext): ShowToast {
  let element: HTMLDivElement | undefined;
  let hideTimer: number | undefined;

  async function show(message: string): Promise<void> {
    const container = await root.container();
    element ??= container.appendChild(h('div', { class: 'ak-surface ak-toast', popover: 'manual', role: 'status' }));
    element.textContent = message;
    // Showing it again moves it above anything opened since, such as a page dialog.
    if (element.matches(':popover-open')) element.hidePopover();
    element.showPopover();
    clearTimeout(hideTimer);
    hideTimer = ctx.setTimeout(() => {
      element?.hidePopover();
    }, VISIBLE_MS);
  }

  return (message) => {
    void show(message);
  };
}
