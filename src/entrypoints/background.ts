import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { installPresets } from '../background/presets';
import { listenForMessages } from '../background/router';
import { welcomeOnInstall } from '../background/welcome';
import { createWriter } from '../storage/writer';

export default defineBackground(() => {
  // Listeners register synchronously so a restarted service worker catches the message that woke it.
  listenForMessages(createWriter());
  // On install and every update the bundled presets change, and at browser start they are put back if they went
  // missing from storage.
  const install = (): void => {
    installPresets().catch((error: unknown) => {
      console.error('AnyKey: presets could not be installed.', error);
    });
  };
  browser.runtime.onInstalled.addListener((details) => {
    install();
    welcomeOnInstall(details).catch((error: unknown) => {
      console.error('AnyKey: the welcome page could not open.', error);
    });
  });
  browser.runtime.onStartup.addListener(install);
});
