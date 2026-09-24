import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import iconUrl from '@/assets/icon.svg';
import { KeyCaps } from '@/components/KeyCaps';
import { isMac } from '@/components/platform';
import { checkbox, errorText, hintText, primaryButton, secondaryButton } from '@/components/styles';
import { useSync } from '@/components/useSync';
import type { PageInfo, PageRequest } from '@/core/messages';
import { resolve, shortcutsForUrl } from '@/core/resolve';
import type { Shortcut } from '@/core/schema';
import { isHost } from '@/core/url';
import { urlParts } from '@/dom/url';
import { sendToBackground } from '@/messaging';

type Page =
  | { status: 'loading' }
  /** No live AnyKey answered in the tab: a browser page, or a tab opened before AnyKey was installed or updated. */
  | { status: 'unavailable'; tabId: number | null }
  | { status: 'ready'; tabId: number; url: string };

export function App() {
  const [page, setPage] = useState<Page>({ status: 'loading' });
  const { data, status, mutate } = useSync();
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    void findPage().then((found) => {
      if (current) setPage(found);
    });
    return () => {
      current = false;
    };
  }, []);

  const reloadable = page.status === 'unavailable' ? page.tabId : null;
  const applying = page.status === 'ready' && data !== null ? shortcutsForUrl(data.state, urlParts(page.url)) : [];
  // What the page's keys do: the popup teaches the keys that work there, which the user may have changed.
  const { active } = resolve({ shortcuts: applying, isMac });

  return (
    <main className="w-80 bg-white p-4 text-sm text-stone-900 dark:bg-stone-900 dark:text-stone-100">
      <header className="flex items-center gap-3">
        <img src={iconUrl} alt="" width={32} height={32} />
        <div className="min-w-0">
          <h1 className="text-base leading-tight font-semibold">AnyKey</h1>
          <p className="truncate text-xs text-stone-600 dark:text-stone-400">
            {page.status === 'ready' ? hostOf(page.url) || 'This page' : 'Keyboard shortcuts for any website'}
          </p>
        </div>
      </header>

      {/* Always in the page, so screen readers announce what appears in it. */}
      <div role="alert">
        {(error !== '' || status.error !== '') && <p className={`${errorText} mt-3`}>{error || status.error}</p>}
      </div>

      {page.status === 'loading' && <p className={`${hintText} mt-4`}>Loading…</p>}

      {page.status === 'unavailable' && (
        <div className="mt-4 space-y-3">
          <p className="font-medium">AnyKey isn&apos;t running in this tab.</p>
          <p className={hintText}>
            If this is a web page, reload it to start AnyKey. Browser pages, such as settings and the extension store,
            don&apos;t allow extensions.
          </p>
          {reloadable !== null && (
            <button
              type="button"
              onClick={() => {
                void browser.tabs.reload(reloadable).then(() => {
                  window.close();
                });
              }}
              className={`${primaryButton} w-full`}
            >
              Reload this tab
            </button>
          )}
        </div>
      )}

      {page.status === 'ready' && data !== null && (
        <SiteControls
          page={page}
          disabled={data.state.sites.get(hostOf(page.url))?.disabled === true}
          shortcuts={applying.filter((shortcut) => shortcut.source === 'user' && shortcut.scope.type === 'site')}
          hints={active.find(({ action }) => action.type === 'hints' && action.newTab !== true)}
          cheatsheet={active.find(({ action }) => action.type === 'cheatsheet')}
          onToggle={(disabled) => {
            void mutate({ op: 'setSiteDisabled', site: hostOf(page.url), disabled });
          }}
          onAdd={() => {
            setError('');
            void sendToBackground({ type: 'startPicker', tabId: page.tabId, host: hostOf(page.url) }).then(
              (response) => {
                // The picker runs in the page, which the popup would cover.
                if (response.ok) window.close();
                else setError(response.error);
              },
            );
          }}
        />
      )}

      <button
        type="button"
        onClick={() => void browser.runtime.openOptionsPage()}
        className={`${secondaryButton} mt-4 w-full`}
      >
        Open settings
      </button>
    </main>
  );
}

interface SiteControlsProps {
  page: Extract<Page, { status: 'ready' }>;
  disabled: boolean;
  /** The site shortcuts that apply to the page. */
  shortcuts: readonly Shortcut[];
  /** The shortcut that shows link hints on the page, if one does. */
  hints: Shortcut | undefined;
  /** The shortcut that opens the cheatsheet on the page, if one does. */
  cheatsheet: Shortcut | undefined;
  onToggle: (disabled: boolean) => void;
  onAdd: () => void;
}

function SiteControls({ page, disabled, shortcuts, hints, cheatsheet, onToggle, onAdd }: SiteControlsProps) {
  const host = hostOf(page.url);
  if (!isHost(host)) {
    return <p className={`${hintText} mt-4`}>Shortcuts for one site work on web pages only.</p>;
  }
  return (
    <div className="mt-4 space-y-4">
      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          role="switch"
          checked={!disabled}
          onChange={(event) => {
            onToggle(!event.target.checked);
          }}
          className={checkbox}
        />
        Use AnyKey on this site
      </label>

      {disabled ? (
        <p className={hintText}>AnyKey is off here, so every key goes to the site.</p>
      ) : (
        <>
          <section aria-labelledby="site-shortcuts-heading">
            <h2 id="site-shortcuts-heading" className="text-xs font-semibold text-stone-600 uppercase dark:text-stone-400">
              Shortcuts for this site
            </h2>
            {shortcuts.length === 0 ? (
              <p className={hintText}>None yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {shortcuts.map((shortcut) => (
                  <li key={shortcut.id} className="flex items-center justify-between gap-3">
                    <span className={`truncate ${shortcut.enabled ? '' : 'text-stone-500 dark:text-stone-400'}`}>
                      {shortcut.label}
                      {!shortcut.enabled && ' (off)'}
                    </span>
                    <KeyCaps keys={shortcut.keys} mode={shortcut.keyMode} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div>
            <button type="button" onClick={onAdd} className={`${primaryButton} w-full`}>
              Add shortcut for this site
            </button>
            <p className={hintText}>
              Pick something on the page, then press the keys you want for it.
              {cheatsheet !== undefined && (
                <>
                  {' '}
                  Press <KeyCaps keys={cheatsheet.keys} mode={cheatsheet.keyMode} /> on the page to see every shortcut.
                </>
              )}
            </p>
          </div>
          {hints !== undefined && (
            <section aria-labelledby="hint-mode-heading">
              <h2 id="hint-mode-heading" className="text-xs font-semibold text-stone-600 uppercase dark:text-stone-400">
                Hint mode
              </h2>
              <p className={hintText}>
                Press <KeyCaps keys={hints.keys} mode={hints.keyMode} /> on the page to label every link and button,
                then type a label to click it. While labels show, keys pick labels instead of running your shortcuts,
                until you pick one or press <KeyCaps keys="escape" mode="key" />.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** The tab the popup is for: the active tab, or `?tab=` (the E2E tests open the popup as a page of its own). */
async function findPage(): Promise<Page> {
  const param = new URLSearchParams(location.search).get('tab');
  const tabId =
    param === null ? (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id : Number(param);
  if (tabId === undefined || !Number.isInteger(tabId) || tabId < 0) return { status: 'unavailable', tabId: null };
  try {
    const info = await browser.tabs.sendMessage<PageRequest, unknown>(tabId, { type: 'pageInfo' }, { frameId: 0 });
    if (isPageInfo(info)) return { status: 'ready', tabId, url: info.url };
  } catch {
    // No content script answered.
  }
  return { status: 'unavailable', tabId };
}

function isPageInfo(value: unknown): value is PageInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof value.url === 'string' &&
    URL.canParse(value.url)
  );
}

/** The site of a web page, or "" for other pages (file URLs). */
function hostOf(href: string): string {
  const url = new URL(href);
  return /^https?:$/.test(url.protocol) ? url.hostname : '';
}
