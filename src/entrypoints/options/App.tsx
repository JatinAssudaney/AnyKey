import iconUrl from '@/assets/icon.svg';
import { APP_NAME } from '@/core/app';

export function App() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <a
        href="#main"
        className="sr-only rounded-md bg-white text-sm font-medium shadow-md focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:px-3 focus:py-2 focus-visible:outline-2 focus-visible:outline-orange-700 dark:bg-stone-800 dark:focus-visible:outline-orange-400"
      >
        Skip to content
      </a>
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <img src={iconUrl} alt="" width={32} height={32} />
          <h1 className="text-lg font-semibold">AnyKey settings</h1>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-8 focus:outline-none">
        <section
          aria-labelledby="about-heading"
          className="rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900"
        >
          <h2 id="about-heading" className="text-base font-semibold">
            {APP_NAME}
          </h2>
          <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
            Shortcut settings will appear here: global and per-site shortcuts, presets, and import and export.
          </p>
        </section>
      </main>
    </div>
  );
}
