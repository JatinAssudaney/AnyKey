// Checks for the fields of the shortcut editor that need the DOM, so they can't live in src/core.

/**
 * A site as someone types it ("GitHub.com", "https://github.com/issues", "localhost:3000") as the host AnyKey keeps
 * its settings under, or "" when it isn't one.
 */
export function normalizeHost(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const url = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return URL.canParse(url) ? new URL(url).hostname : '';
}

/** Whether each step of a target selector (the parts between " >>> ") is CSS the browser can look elements up with. */
export function isValidSelector(selector: string): boolean {
  const fragment = document.createDocumentFragment();
  return selector.split(/\s*>>>\s*/).every((step) => {
    if (step.trim() === '') return false;
    try {
      fragment.querySelector(step);
      return true;
    } catch {
      return false;
    }
  });
}
