import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  /** The dialog closed (Esc, or a form inside it); the owner should stop rendering it. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * A native modal `<dialog>`, open while rendered: it keeps focus inside, closes on Esc, and hands focus back to the
 * control that opened it. Owners render it conditionally and stop rendering it in `onClose`.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // Closing while the element is still in the page lets the browser move focus back to where it was.
    return () => {
      dialog?.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={(event) => {
        // A close queued by an earlier mount (StrictMode mounts twice in development) finds the dialog open again.
        if (!event.currentTarget.open) onClose();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-6 text-stone-900 shadow-xl backdrop:bg-stone-950/50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
