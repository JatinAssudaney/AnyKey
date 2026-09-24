import { isHost, type UrlParts } from './url';

/**
 * A parsed Chrome match pattern (https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).
 * WXT ships a MatchPattern class, but it ignores query strings and needs the DOM, so core has its own.
 */
export type MatchPattern =
  | { kind: 'all' }
  | {
      kind: 'url';
      scheme: string;
      /** "*" for any host. */
      host: string;
      /** A leading "*." also matches the host itself and every subdomain. */
      subdomains: boolean;
      /** null when the pattern names no port, which matches any port. */
      port: string | null;
      path: RegExp;
    };

const SCHEMES = new Set(['*', 'http', 'https', 'file']);
const ALL_URLS_SCHEMES = new Set(['http', 'https', 'file']);
const DEFAULT_PORTS = new Map([
  ['http', '80'],
  ['https', '443'],
]);
const PATTERN = /^([^:/]+):\/\/([^/]*)(\/.*)$/;
const PORT = /^(.+):(\d{1,5}|\*)$/;

export function parseMatchPattern(pattern: string): MatchPattern | null {
  if (pattern === '<all_urls>') return { kind: 'all' };
  const [, scheme = '', authority = '', path = ''] = PATTERN.exec(pattern) ?? [];
  if (!SCHEMES.has(scheme)) return null;

  let host = authority.toLowerCase();
  let port: string | null = null;
  const withPort = PORT.exec(host);
  if (withPort) {
    host = withPort[1] ?? '';
    port = withPort[2] ?? null;
  }

  if (scheme === 'file') {
    if (host !== '' || port !== null) return null;
    return { kind: 'url', scheme, host: '', subdomains: false, port: null, path: globToRegExp(path) };
  }

  const subdomains = host.startsWith('*.');
  if (subdomains) host = host.slice(2);
  // Every host a site doc can have makes a pattern (`siteMatch`), so the host grammar is the same.
  if (host === '' || (host !== '*' && !isHost(host)) || (subdomains && host === '*')) return null;
  return { kind: 'url', scheme, host, subdomains, port, path: globToRegExp(path) };
}

export function matchesUrl(pattern: MatchPattern, url: UrlParts): boolean {
  if (pattern.kind === 'all') return ALL_URLS_SCHEMES.has(url.scheme);

  const schemeMatches =
    pattern.scheme === '*' ? url.scheme === 'http' || url.scheme === 'https' : pattern.scheme === url.scheme;
  if (!schemeMatches) return false;

  if (pattern.host !== '*') {
    const hostMatches = pattern.subdomains
      ? url.host === pattern.host || url.host.endsWith(`.${pattern.host}`)
      : url.host === pattern.host;
    if (!hostMatches) return false;
  }

  if (pattern.port !== null && pattern.port !== '*') {
    const port = url.port === '' ? DEFAULT_PORTS.get(url.scheme) : url.port;
    if (port !== pattern.port) return false;
  }

  return pattern.path.test(url.path);
}

/** Parses and matches in one step. An invalid pattern matches nothing. */
export function matchesPattern(pattern: string, url: UrlParts): boolean {
  const parsed = parseMatchPattern(pattern);
  return parsed !== null && matchesUrl(parsed, url);
}

function globToRegExp(glob: string): RegExp {
  const source = glob
    .split('*')
    .map((literal) => literal.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`);
}
