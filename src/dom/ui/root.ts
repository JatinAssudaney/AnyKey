import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createShadowRootUi, type ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import css from './styles.css?inline';

/** The tag of the element that hosts AnyKey's shadow root. */
export const UI_HOST = 'anykey-ui';

export interface UiRoot {
  /** The container inside AnyKey's shadow root. Mounts on first use, and again if the page removed the host. */
  container(): Promise<HTMLElement>;
  /** Whether an event target is AnyKey's UI: the closed shadow root retargets every event to its host. */
  owns(target: EventTarget | null): boolean;
}

/**
 * The one shadow root for all in-page UI (cheatsheet, toasts, and later hints and the picker). It is closed, so
 * page scripts can't reach inside, and its CSS goes in as text, so no stylesheet is web-accessible for pages to
 * probe. The host sits on <html>, which survives pages that replace <body>. Overlays inside use the top layer.
 */
export function createUiRoot(ctx: ContentScriptContext): UiRoot {
  let ui: Promise<ShadowRootContentScriptUi<undefined>> | undefined;
  let host: HTMLElement | undefined;
  return {
    async container() {
      ui ??= createShadowRootUi(ctx, {
        name: UI_HOST,
        position: 'inline',
        anchor: () => document.documentElement,
        mode: 'closed',
        // No `isolateEvents`: the key engine already keeps AnyKey's UI events from the page, and WXT's bubble-phase
        // stop would also hide keyups the page is owed (Shift released while the cheatsheet has focus).
        css,
        onMount: () => undefined,
      });
      const mounted = await ui;
      host = mounted.shadowHost;
      if (!host.isConnected) mounted.mount();
      return mounted.uiContainer;
    },
    owns: (target) => host !== undefined && target === host,
  };
}
