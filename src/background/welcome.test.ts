import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { welcomeOnInstall } from './welcome';

describe('welcomeOnInstall', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('opens the welcome page when AnyKey is installed', async () => {
    const create = vi.spyOn(browser.tabs, 'create');
    await welcomeOnInstall({ reason: 'install' });
    expect(create).toHaveBeenCalledExactlyOnceWith({ url: browser.runtime.getURL('/welcome.html') });
  });

  it.each(['update', 'chrome_update', 'shared_module_update'] as const)('opens nothing on %s', async (reason) => {
    const create = vi.spyOn(browser.tabs, 'create');
    await welcomeOnInstall({ reason });
    expect(create).not.toHaveBeenCalled();
  });
});
