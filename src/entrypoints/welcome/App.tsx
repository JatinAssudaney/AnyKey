import { browser } from 'wxt/browser';
import iconUrl from '@/assets/icon.svg';
import { CommandKeyCaps, KeyCaps } from '@/components/KeyCaps';
import { isMac } from '@/components/platform';
import { listNodes, rich } from '@/components/rich';
import { card, focusRing, headerLink, hintText, linkButton, primaryButton } from '@/components/styles';
import { openShortcutsPage, usePanelKey } from '@/components/usePanelKey';
import { usePresets } from '@/components/usePresets';
import { useSync } from '@/components/useSync';
import { presetHosts } from '@/core/presets';
import { pageShortcuts, resolve } from '@/core/resolve';
import type { Action, Shortcut } from '@/core/schema';
import { urlParts, withoutHash } from '@/dom/url';
import { locale, t, type MessageKey } from '@/i18n';

/** Section headings: larger than the options page's, over this page's larger text. */
const heading = 'text-lg font-semibold';

/** The keys the page teaches first, each found by what it does, since the user may have changed its keys. */
const TRY: readonly { does: (action: Action) => boolean; text: MessageKey }[] = [
  { does: (action) => action.type === 'scroll' && action.direction === 'down', text: 'welcome.try.scrollDown' },
  { does: (action) => action.type === 'scroll' && action.direction === 'up', text: 'welcome.try.scrollUp' },
  { does: (action) => action.type === 'cheatsheet', text: 'welcome.try.cheatsheet' },
  {
    does: (action) => action.type === 'hints' && action.newTab !== true,
    text: 'welcome.try.hints',
  },
  {
    does: (action) => action.type === 'hints' && action.newTab === true,
    text: 'welcome.try.hintsNewTab',
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
    .sort((a, b) => a.name.localeCompare(b.name, locale()));

  return (
    // text-base: the browser's own style for extension pages makes text 12px.
    <div className="min-h-screen bg-stone-50 text-base text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <main className="mx-auto max-w-2xl px-6 py-12 text-pretty [&_kbd]:text-sm">
        <header className="flex items-center gap-4">
          <img src={iconUrl} alt="" width={56} height={56} />
          <div>
            <h1 className="text-2xl font-semibold">{t('welcome.title')}</h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">{t('common.tagline')}</p>
          </div>
          {/* Also something at the top of the page to try link hints on: a button, which both kinds of hint click. */}
          <button type="button" onClick={openSettings} className={`ml-auto ${headerLink}`}>
            {t('common.settings')}
          </button>
        </header>
        <p className="mt-6">{t('welcome.intro')}</p>

        {active !== null && tries.length > 0 && (
          <section aria-labelledby="try-heading" className={`${card} mt-8`}>
            <h2 id="try-heading" className={heading}>
              {t('welcome.tryHeading')}
            </h2>
            <dl className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
              {tries.map(({ shortcut, text }) => (
                <div key={shortcut.id} className="flex items-center gap-4 py-3">
                  <dt className="w-24 shrink-0 [&_kbd]:px-2 [&_kbd]:py-1">
                    <KeyCaps keys={shortcut.keys} mode={shortcut.keyMode} />
                  </dt>
                  <dd>{t(text)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="picker-heading" className={`${card} mt-6`}>
          <h2 id="picker-heading" className={heading}>
            {t('welcome.pickerHeading')}
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <OpenPanelStep />
            <li>{rich('welcome.stepAdd', { button: <strong className="font-semibold">{t('popup.add')}</strong> })}</li>
            <li>{t('welcome.stepKeys')}</li>
          </ol>
          <p className={`${hintText} mt-3`}>{t('welcome.pinHint')}</p>
        </section>

        {sites.length > 0 && (
          <section aria-labelledby="presets-heading" className={`${card} mt-6`}>
            <h2 id="presets-heading" className={heading}>
              {t('welcome.presetsHeading')}
            </h2>
            <p className="mt-2">
              {rich(
                'welcome.presets',
                {
                  sites: listNodes(
                    sites.map(({ name, url }) => (
                      <a href={url} target="_blank" rel="noreferrer" className={`font-medium underline ${focusRing}`}>
                        {name}
                      </a>
                    )),
                  ),
                },
                sites.length,
              )}
              {cheatsheet !== undefined && (
                <>
                  {' '}
                  {rich('welcome.presetsCheatsheet', {
                    keys: <KeyCaps keys={cheatsheet.keys} mode={cheatsheet.keyMode} />,
                  })}
                </>
              )}
            </p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={openSettings} className={primaryButton}>
            {t('common.openSettings')}
          </button>
          <p className="text-sm text-stone-600 dark:text-stone-400">{t('welcome.settingsHint')}</p>
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
      {key === null || key === ''
        ? t('welcome.stepOpen')
        : rich('welcome.stepOpenKey', { keys: <CommandKeyCaps shortcut={key} /> })}
      {key === '' && (
        <>
          {' '}
          {rich('welcome.stepSetKey', {
            setKey: (
              <button type="button" onClick={openShortcutsPage} className={linkButton}>
                {t('common.setKey')}
              </button>
            ),
          })}
        </>
      )}
    </li>
  );
}

function openSettings(): void {
  void browser.runtime.openOptionsPage();
}
