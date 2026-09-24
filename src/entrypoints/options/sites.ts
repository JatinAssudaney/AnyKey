import { normalizeHost } from './fields';

/** Sites in the order people look for them: by host, leaving out a leading "www.". */
export function sortHosts(hosts: Iterable<string>): string[] {
  return [...hosts].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.localeCompare(b));
}

function sortKey(host: string): string {
  return host.replace(/^www\./, '');
}

/**
 * Whether a site matches what was typed to find it: part of its host, or of the name of a preset it has. A pasted
 * address finds its site.
 */
export function siteMatches(host: string, presetNames: readonly string[], query: string): boolean {
  const typed = query.trim().toLowerCase();
  const wanted = /[/:]/.test(typed) ? normalizeHost(typed) || typed : typed;
  return [host, ...presetNames].some((name) => name.toLowerCase().includes(wanted));
}

/** "1 shortcut", "3 shortcuts". */
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
