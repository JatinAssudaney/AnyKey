import { browser, type Browser } from 'wxt/browser';

/**
 * Opens the welcome page when AnyKey is first installed. An update opens nothing: people who update know AnyKey
 * already, and a tab opening with every release would nag.
 */
export async function welcomeOnInstall({ reason }: Browser.runtime.InstalledDetails): Promise<void> {
  if (reason !== 'install') return;
  await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
}
