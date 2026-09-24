import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { DEFAULT_SETTINGS } from '../core/defaults';
import { effectiveSettings, type SyncState } from '../core/docs';
import { sequenceTokens } from '../core/keys';
import { resolve, shortcutsForUrl } from '../core/resolve';
import type { Settings, Shortcut } from '../core/schema';
import { watchSync } from '../storage/read';
import { startEngine } from './engine';
import { createExecutor } from './executor';
import { isMac } from './platform';
import { createScroller } from './scroll';
import { openCheatsheet } from './ui/cheatsheet';
import { createUiRoot } from './ui/root';
import { createToast } from './ui/toast';
import { urlParts, withoutHash } from './url';

/** Starts AnyKey in a page, with the shortcuts and settings from storage, and follows changes to them. */
export function startAnyKey(ctx: ContentScriptContext): void {
  let settings: Settings = DEFAULT_SETTINGS;
  /** Null until storage has loaded; until then no shortcut runs, so a disabled key never fires early. */
  let state: SyncState | null = null;
  /**
   * The URL the active shortcuts were resolved for, without its `#` part: match patterns ignore it, and some sites
   * rewrite it as you scroll, which mustn't reset a sequence such as g g.
   */
  let resolvedUrl = '';
  const ui = createUiRoot(ctx);
  const toast = createToast(ui, ctx);
  let active: readonly Shortcut[] = [];
  let cheatsheetOpen = false;

  const engine = startEngine({
    ctx,
    ui,
    isMac,
    sequenceTimeoutMs: () => settings.sequenceTimeoutMs,
    beforeMatch: () => {
      // Single-page apps change the URL without a reload, and which site shortcuts apply depends on it.
      if (withoutHash(location.href) !== resolvedUrl) applyShortcuts();
    },
    run: (shortcut, repeat) => {
      runAction(shortcut.action, repeat);
    },
  });

  const runAction = createExecutor({
    settings: () => settings,
    scroller: createScroller(ctx),
    toast,
    openCheatsheet: () => {
      if (cheatsheetOpen) return;
      cheatsheetOpen = true;
      const closeTokens = active
        .filter((shortcut) => shortcut.action.type === 'cheatsheet' && shortcut.keyMode === 'key')
        .flatMap((shortcut) => {
          const tokens = sequenceTokens(shortcut.keys, shortcut.keyMode, isMac);
          return tokens?.length === 1 ? tokens : [];
        });
      openCheatsheet({
        root: ui,
        isMac,
        shortcuts: active,
        closeTokens,
        scrollStep: settings.scrollStep,
        pushMode: (mode) => {
          engine.pushMode(mode);
        },
        popMode: (mode) => {
          engine.popMode(mode);
          cheatsheetOpen = false;
        },
      }).catch((error: unknown) => {
        cheatsheetOpen = false;
        console.error('AnyKey: the cheatsheet failed to open.', error);
      });
    },
  });

  function applyShortcuts(): void {
    if (state === null) return;
    resolvedUrl = withoutHash(location.href);
    active = resolve({ shortcuts: shortcutsForUrl(state, urlParts(resolvedUrl)), isMac }).active;
    engine.setShortcuts(active);
  }

  const watcher = watchSync((data) => {
    state = data.state;
    settings = effectiveSettings(data.state);
    applyShortcuts();
  });
  ctx.onInvalidated(() => {
    watcher.stop();
  });
}
