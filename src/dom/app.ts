import { browser, type Browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { DEFAULT_SETTINGS } from '../core/defaults';
import { effectiveSettings, type SyncState } from '../core/docs';
import { keysInWords, sequenceTokens } from '../core/keys';
import type { BackgroundResponse, PageInfo, PageRequest } from '../core/messages';
import { resolve, shortcutsForUrl } from '../core/resolve';
import type { Settings, Shortcut } from '../core/schema';
import { sendToBackground } from '../messaging';
import { watchSync } from '../storage/read';
import { startEngine } from './engine';
import { createExecutor } from './executor';
import { openHints } from './hints';
import { createPicker } from './picker';
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
      runShortcut(shortcut, repeat);
    },
  });

  const runShortcut = createExecutor({
    settings: () => settings,
    scroller: createScroller(ctx),
    isMac,
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
    openHints: (activate, newTab) => {
      openHints({
        ctx,
        ui,
        chars: settings.hintChars,
        newTab,
        pushMode: (mode) => {
          engine.pushMode(mode);
        },
        popMode: (mode) => {
          engine.popMode(mode);
        },
        activate,
        toast,
      });
    },
  });

  const picker = createPicker({
    ctx,
    ui,
    isMac,
    pushMode: (mode) => {
      engine.pushMode(mode);
    },
    popMode: (mode) => {
      engine.popMode(mode);
    },
    pageShortcuts: () => (state === null ? [] : shortcutsForUrl(state, urlParts(withoutHash(location.href)))),
    save: async (shortcut) => {
      const response = await sendToBackground({ type: 'addSiteShortcut', shortcut });
      return response.ok ? null : response.error;
    },
    closed: (saved) => {
      void sendToBackground({ type: 'pickerDone' });
      const [only] = saved;
      if (saved.length > 1) toast(`Saved ${saved.length} shortcuts for this site.`);
      else if (only !== undefined) {
        toast(`Saved "${only.label}". Press ${keysInWords(only.keys, only.keyMode, isMac)} to use it.`);
      }
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

  /** Requests from the popup and the background, which only AnyKey itself can send to a content script. */
  function onMessage(message: unknown, _sender: Browser.runtime.MessageSender, sendResponse: (response: unknown) => void): boolean {
    if (ctx.isInvalid || !isPageRequest(message)) return false;
    if (message.type === 'pageInfo') {
      sendResponse({ ok: true, url: withoutHash(location.href) } satisfies PageInfo);
    } else {
      picker.start();
      sendResponse({ ok: true } satisfies BackgroundResponse);
    }
    return false;
  }
  browser.runtime.onMessage.addListener(onMessage);

  ctx.onInvalidated(() => {
    watcher.stop();
    try {
      browser.runtime.onMessage.removeListener(onMessage);
    } catch {
      // After an extension reload this script can't reach the API, and its listener is dead anyway.
    }
  });
}

function isPageRequest(value: unknown): value is PageRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value.type === 'pageInfo' || value.type === 'startPicker')
  );
}
