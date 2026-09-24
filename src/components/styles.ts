// Tailwind class lists shared by the popup and the options page.

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 dark:focus-visible:outline-orange-400';

const button = `inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const primaryButton = `${button} bg-orange-700 text-white hover:bg-orange-800 dark:bg-orange-400 dark:text-stone-950 dark:hover:bg-orange-300`;

export const secondaryButton = `${button} border border-stone-300 bg-white hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-900 dark:hover:bg-stone-800`;

export const dangerButton = `${button} bg-red-700 text-white hover:bg-red-800 dark:bg-red-400 dark:text-stone-950 dark:hover:bg-red-300`;

/** A small text button inside table rows. */
export const linkButton = `rounded px-1.5 py-0.5 text-sm font-medium text-orange-800 underline-offset-2 hover:underline dark:text-orange-300 ${focusRing}`;

export const textInput = `block w-full rounded-md border border-stone-400 bg-white px-2.5 py-1.5 text-sm placeholder:text-stone-500 aria-invalid:border-red-700 dark:border-stone-500 dark:bg-stone-950 dark:placeholder:text-stone-400 dark:aria-invalid:border-red-400 ${focusRing}`;

export const checkbox = `size-4 shrink-0 accent-orange-700 dark:accent-orange-400 ${focusRing}`;

export const fieldLabel = 'block text-sm font-medium';

export const hintText = 'mt-1 text-sm text-stone-600 dark:text-stone-400';

export const errorText = 'mt-1 text-sm font-medium text-red-700 dark:text-red-400';

export const card = 'rounded-lg border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900';

export const sectionHeading = 'text-base font-semibold';
