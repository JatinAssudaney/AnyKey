/** The parts of a URL that match patterns look at. Callers build it from `URL` or `location`, which core can't use. */
export interface UrlParts {
  /** Lowercase scheme without the colon, such as "https". */
  scheme: string;
  /** Lowercase hostname without the port. Empty for file URLs. */
  host: string;
  /** The port as written in the URL, or "" for the scheme's default port. */
  port: string;
  /** Path plus query string, such as "/watch?v=1". Match patterns ignore the fragment. */
  path: string;
}

export const MAX_URL_LENGTH = 2048;

const SCHEME = /^([a-z][a-z\d+.-]*):/i;

/**
 * True for http(s) URLs and relative URLs: the only URLs a shortcut may open, so stored or imported data can never
 * carry `javascript:` or `data:` URLs. Whitespace and control characters are rejected outright because URL parsers
 * strip them, which turns "java\tscript:" into "javascript:".
 */
export function isSafeUrl(url: string): boolean {
  if (url.length === 0 || url.length > MAX_URL_LENGTH) return false;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    if (c <= 0x20 || c === 0x7f) return false;
  }
  const scheme = SCHEME.exec(url)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === 'http' || scheme === 'https';
}

/** An absolute http(s) URL: what the background accepts for opening tabs, after the content script resolved it. */
export function isHttpUrl(url: string): boolean {
  return isSafeUrl(url) && /^https?:\/\//i.test(url);
}
