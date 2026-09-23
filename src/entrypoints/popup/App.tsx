import { browser } from 'wxt/browser';
import iconUrl from '@/assets/icon.svg';

export function App() {
  return (
    <main className="w-80 bg-white p-4 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
      <header className="flex items-center gap-3">
        <img src={iconUrl} alt="" width={32} height={32} />
        <div>
          <h1 className="text-base leading-tight font-semibold">AnyKey</h1>
          <p className="text-xs text-stone-600 dark:text-stone-400">Keyboard shortcuts for any website</p>
        </div>
      </header>
      <p className="mt-4 text-sm text-stone-700 dark:text-stone-300">
        Per-site controls and the element picker will appear here.
      </p>
      <button
        type="button"
        onClick={() => void browser.runtime.openOptionsPage()}
        className="mt-4 w-full rounded-md bg-orange-700 px-3 py-2 text-sm font-medium text-white hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 dark:bg-orange-400 dark:text-stone-950 dark:hover:bg-orange-300 dark:focus-visible:outline-orange-400"
      >
        Open settings
      </button>
    </main>
  );
}
