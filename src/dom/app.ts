import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { DEFAULT_SETTINGS, DEFAULT_SHORTCUTS } from '../core/defaults';
import { sequenceTokens } from '../core/keys';
import { resolve } from '../core/resolve';
import type { Shortcut } from '../core/schema';
import { startEngine } from './engine';
import { createExecutor } from './executor';
import { isMac } from './platform';
import { createScroller } from './scroll';
import { openCheatsheet } from './ui/cheatsheet';
import { createUiRoot } from './ui/root';
import { createToast } from './ui/toast';

/** Starts AnyKey in a page. Shortcuts are the built-in defaults until settings storage lands (M3). */
export function startAnyKey(ctx: ContentScriptContext): void {
  const settings = DEFAULT_SETTINGS;
  const ui = createUiRoot(ctx);
  const toast = createToast(ui, ctx);
  let active: readonly Shortcut[] = [];
  let cheatsheetOpen = false;

  const engine = startEngine({
    ctx,
    ui,
    isMac,
    sequenceTimeoutMs: () => settings.sequenceTimeoutMs,
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

  active = resolve({ shortcuts: DEFAULT_SHORTCUTS, isMac }).active;
  engine.setShortcuts(active);
}
