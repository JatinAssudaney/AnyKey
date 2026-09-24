import { Fragment } from 'react';
import { browser } from 'wxt/browser';
import iconUrl from '@/assets/icon.svg';
import { CommandKeyCaps, KeyCaps } from '@/components/KeyCaps';
import { isMac } from '@/components/platform';
import { card, focusRing, headerLink, hintText, linkButton, primaryButton } from '@/components/styles';
import { openShortcutsPage, usePanelKey } from '@/components/usePanelKey';
import { usePresets } from '@/components/usePresets';
import { useSync } from '@/components/useSync';
import { presetHosts } from '@/core/presets';
import { pageShortcuts, resolve } from '@/core/resolve';
import type { Action, Shortcut } from '@/core/schema';
import { urlParts, withoutHash } from '@/dom/url';

/** Section headings: larger than the options page's, over this page's larger text. */
const heading = 'text-lg font-semibold';

/** The keys the page teaches first, each found by what it does, since the user may have changed its keys. */
const TRY: readonly { does: (action: Action) => boolean; text: string }[] = [
  { does: (action) => action.type === 'scroll' && action.direction === 'down', text: 'Scroll down' },
  { does: (action) => action.type === 'scroll' && action.direction === 'up', text: 'Scroll up' },
  { does: (action) => action.type === 'cheatsheet', text: 'See every shortcut, on any page' },
  {
    does: (action) => action.type === 'hints' && action.newTab !== true,
    text: 'Label every link and button, then type a label to click it',
  },
  {
    does: (action) => action.type === 'hints' && action.newTab === true,
    text: 'Open a link in a new tab, the same way',
  },
];

export function App() {
  const { data } = useSync();
  const presets = usePresets();
  // What this page's keys do, as on any page: AnyKey runs here too (see main.tsx).
  const here = urlParts(withoutHash(location.href));
  const page = data === null || presets === null ? null : pageShortcuts(data.state, presets, here);
  const active = page === null ? null : resolve({ shortcuts: page.shortcuts, isMac }).active;
  const keyFor = (does: (action: Action) => boolean): Shortcut | undefined =>
    active?.find((shortcut) => does(shortcut.action));
  const tries = TRY.flatMap(({ does, text }) => {
    const shortcut = keyFor(does);
    return shortcut === undefined ? [] : [{ shortcut, text }];
  });
  const cheatsheet = keyFor((action) => action.type === 'cheatsheet');
  const sites = (presets ?? [])
    .flatMap((preset) => {
      const [host] = presetHosts(preset);
      return host === undefined ? [] : [{ name: preset.name, url: `https://${host}/` }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    // text-base: the browser's own style for extension pages makes text 12px.
    <div className="min-h-screen bg-stone-50 text-base text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-2xl px-6 py-12 text-pretty [&_kbd]:text-sm">
        <header className="flex items-center gap-4">
          <img src={iconUrl} alt="" width={56} height={56} />
          <div>
            <h1 className="text-2xl font-semibold">Welcome to AnyKey</h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">Keyboard shortcuts for any website</p>
          </div>
          {/* Also something at the top of the page to try link hints on: a button, which both kinds of hint click. */}
          <button type="button" onClick={openSettings} className={`ml-auto ${headerLink}`}>
            Settings
          </button>
        </header>
        <p className="mt-6">
          Scroll, click links and switch tabs from the keyboard on any website, and give a key to anything on a page.
          AnyKey works on this page too, so try its keys as you read.
        </p>

        {active !== null && tries.length > 0 && (
          <section aria-labelledby="try-heading" className={`${card} mt-8`}>
            <h2 id="try-heading" className={heading}>
              Try these now
            </h2>
            <dl className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
              {tries.map(({ shortcut, text }) => (
                <div key={shortcut.id} className="flex items-center gap-4 py-3">
                  <dt className="w-24 shrink-0 [&_kbd]:px-2 [&_kbd]:py-1">
                    <KeyCaps keys={shortcut.keys} mode={shortcut.keyMode} />
                  </dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="open-tabs-heading" className={`${card} mt-6`}>
          <h2 id="open-tabs-heading" className={heading}>
            Tabs you already had open
          </h2>
          <p className="mt-2">
            Pages that were open before you installed AnyKey don&apos;t have it yet. Reload one with{' '}
            <KeyCaps keys="mod+r" mode="key" /> and AnyKey starts there. Pages you open from now on have it right away.
          </p>
        </section>

        <section aria-labelledby="picker-heading" className={`${card} mt-6`}>
          <h2 id="picker-heading" className={heading}>
            Give anything a key
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <OpenPanelStep />
            <li>
              Choose <strong className="font-semibold">Add shortcut for this site</strong>, then click what you want a
              key for: a button, a link, a menu.
            </li>
            <li>
              Press the keys you want, then Enter. Pick something else for another shortcut, or press Esc when done.
            </li>
          </ol>
          <p className={`${hintText} mt-3`}>
            AnyKey&apos;s button starts in the extensions menu, the puzzle piece in the toolbar. Pin it there to keep it
            in view.
          </p>
        </section>

        {sites.length > 0 && (
          <section aria-labelledby="presets-heading" className={`${card} mt-6`}>
            <h2 id="presets-heading" className={heading}>
              Made for your favorite sites
            </h2>
            <p className="mt-2">
              {sites.map(({ name, url }, i) => (
                <Fragment key={url}>
                  {i > 0 && (i === sites.length - 1 ? ' and ' : ', ')}
                  <a href={url} target="_blank" rel="noreferrer" className={`font-medium underline ${focusRing}`}>
                    {name}
                  </a>
                </Fragment>
              ))}{' '}
              {sites.length === 1 ? 'comes' : 'come'} with extra shortcuts, and their own keys keep working.
              {cheatsheet !== undefined && (
                <>
                  {' '}
                  Press <KeyCaps keys={cheatsheet.keys} mode={cheatsheet.keyMode} /> on one of them to see both.
                </>
              )}
            </p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={openSettings} className={primaryButton}>
            Open settings
          </button>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Change any key, add your own shortcuts, or turn AnyKey off on a site.
          </p>
        </div>
      </main>
    </div>
  );
}

/** How to open AnyKey's panel: its key, which the browser holds, and the toolbar button. */
function OpenPanelStep() {
  const key = usePanelKey();
  return (
    <li>
      On a website,{' '}
      {key === null || key === '' ? (
        'click'
      ) : (
        <>
          press <CommandKeyCaps shortcut={key} /> or click
        </>
      )}{' '}
      AnyKey&apos;s button in the toolbar.
      {key === '' && (
        <>
          {' '}
          <button type="button" onClick={openShortcutsPage} className={linkButton}>
            Set a key
          </button>{' '}
          to open it from the keyboard.
        </>
      )}
    </li>
  );
}

function openSettings(): void {
  void browser.runtime.openOptionsPage();
}
