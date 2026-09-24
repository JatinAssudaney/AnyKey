// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { DEFAULT_SHORTCUTS } from '../../core/defaults';
import type { NativeKey } from '../../core/resolve';
import { openCheatsheet } from './cheatsheet';

const video = (keys: string, label: string): NativeKey => ({ keys, label, site: 'YouTube' });

async function open(native: readonly NativeKey[]): Promise<HTMLDialogElement> {
  const container = document.createElement('div');
  document.body.append(container);
  await openCheatsheet({
    root: { container: () => Promise.resolve(container), owns: () => false },
    isMac: false,
    shortcuts: DEFAULT_SHORTCUTS,
    native,
    closeTokens: ['?'],
    scrollStep: 60,
    pushMode: () => undefined,
    popMode: () => undefined,
  });
  const dialog = container.querySelector('dialog');
  if (dialog === null) throw new Error('No cheatsheet');
  return dialog;
}

function headings(dialog: HTMLDialogElement): string[] {
  return [...dialog.querySelectorAll('h3')].map((heading) => heading.textContent);
}

function rows(dialog: HTMLDialogElement): string[] {
  return [...dialog.querySelectorAll('tr')].map((row) => [...row.cells].map((cell) => cell.textContent).join(': '));
}

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(browser.dom, 'openOrClosedShadowRoot').mockReturnValue(null);
});

describe('openCheatsheet', () => {
  it("lists the site's own keys before AnyKey's", async () => {
    const dialog = await open([video('j', 'Go back 10 seconds')]);
    expect(headings(dialog)).toEqual(["YouTube's own keys", 'Scrolling', 'Pages and links', 'Tabs', 'Help']);
    expect(rows(dialog)[0]).toBe('j: Go back 10 seconds');
  });

  it('puts keys that do the same thing on one row', async () => {
    const dialog = await open([video('k', 'Play or pause'), video('m', 'Mute'), video('space', 'Play or pause')]);
    expect(rows(dialog).slice(0, 2)).toEqual(['k or Space: Play or pause', 'm: Mute']);
  });

  it('widens when there is a lot to list', async () => {
    expect((await open([])).classList.contains('ak-cheatsheet-wide')).toBe(false);
    const many = Array.from({ length: 12 }, (_, i) => video(String(i), `Go to ${String(i * 10)}%`));
    expect((await open(many)).classList.contains('ak-cheatsheet-wide')).toBe(true);
  });
});
