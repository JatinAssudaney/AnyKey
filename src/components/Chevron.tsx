/** The arrow of something that opens: it points right, and a class turns it down when open. */
export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`size-4 shrink-0 text-stone-500 transition-transform motion-reduce:transition-none dark:text-stone-400 ${className}`}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
