import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * The key that opens AnyKey's panel (the toolbar popup, through the manifest's `_execute_action` command), written
 * as the browser writes it: "⌥⇧K", "Alt+Shift+K". "" when no key opens it, null until known. The browser holds the
 * key, and people change it on its extension shortcuts page, so it is read again whenever the page gets focus.
 */
export function usePanelKey(): string | null {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    const read = (): void => {
      void browser.commands.getAll().then((commands) => {
        if (current) setKey(commands.find(({ name }) => name === '_execute_action')?.shortcut ?? '');
      });
    };
    read();
    addEventListener('focus', read);
    return () => {
      current = false;
      removeEventListener('focus', read);
    };
  }, []);
  return key;
}

/** Opens the browser's page for extension shortcuts, where the panel's key is set. Brave shows it as brave://. */
export function openShortcutsPage(): void {
  void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
}
