import { useState } from 'react';
import iconUrl from '@/assets/icon.svg';
import { focusRing } from '@/components/styles';
import { DataSection } from './sections/DataSection';
import { SettingsSection } from './sections/SettingsSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { SitesSection } from './sections/SitesSection';
import { usePresets } from '@/components/usePresets';
import { useSync } from '@/components/useSync';

export function App() {
  const { data, backup, status, mutate } = useSync();
  const presets = usePresets();
  // Which site's settings show: a save in either section that puts a shortcut on a site opens it.
  const [openSite, setOpenSite] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <a
        href="#main"
        className={`sr-only rounded-md bg-white text-sm font-medium shadow-md focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:px-3 focus:py-2 dark:bg-stone-800 ${focusRing}`}
      >
        Skip to content
      </a>
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <img src={iconUrl} alt="" width={32} height={32} />
          <h1 className="text-lg font-semibold">AnyKey settings</h1>
          <p role="status" className="ml-auto text-sm text-stone-600 dark:text-stone-400">
            {status.progress}
          </p>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-8 focus:outline-none">
        {/* Always in the page, so screen readers announce what appears in it. */}
        <div role="alert">
          {status.error !== '' && (
            <p className="mb-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {status.error}
            </p>
          )}
        </div>
        {data === null || presets === null ? (
          <p className="text-sm text-stone-600 dark:text-stone-400">Loading your settings…</p>
        ) : (
          <div className="space-y-6">
            {data.problems.size > 0 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
                Some of your settings need attention. See{' '}
                <a href="#data-heading" className={`font-medium underline ${focusRing}`}>
                  Your data
                </a>
                .
              </p>
            )}
            <ShortcutsSection data={data} presets={presets} mutate={mutate} onShowSite={setOpenSite} />
            <SitesSection data={data} presets={presets} mutate={mutate} openSite={openSite} onOpenSite={setOpenSite} />
            <SettingsSection data={data} mutate={mutate} />
            <DataSection data={data} backup={backup} mutate={mutate} />
          </div>
        )}
      </main>
    </div>
  );
}
