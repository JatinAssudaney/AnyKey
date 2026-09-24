import type { UrlParts } from '../core/url';

/** `href` without its `#` part, which match patterns ignore. A serialized URL has `#` only there. */
export function withoutHash(href: string): string {
  const index = href.indexOf('#');
  return index === -1 ? href : href.slice(0, index);
}

/** The parts of `href` that match patterns look at, or null when it doesn't parse. */
export function urlParts(href: string): UrlParts | null {
  if (!URL.canParse(href)) return null;
  const url = new URL(href);
  return { scheme: url.protocol.slice(0, -1), host: url.hostname, port: url.port, path: url.pathname + url.search };
}
