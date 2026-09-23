import { sequenceTokens } from './keys';
import type { Shortcut } from './schema';

export interface Shadowed {
  shortcut: Shortcut;
  /** The higher-precedence shortcut that takes its keys. */
  by: Shortcut;
}

export interface Resolution {
  /** In precedence order, highest first. */
  active: Shortcut[];
  shadowed: Shadowed[];
}

/** Precedence: user site > user global > preset > default. */
export function rankOf(shortcut: Shortcut): number {
  if (shortcut.source === 'user') return shortcut.scope.type === 'site' ? 3 : 2;
  return shortcut.source === 'preset' ? 1 : 0;
}

/**
 * Picks the shortcuts that can fire (rules in docs/design.md, "Resolution"). Disabled shortcuts and unparseable
 * keys drop out. For identical key sequences the higher-precedence shortcut wins, and the first one wins within a
 * rank. A higher-precedence sequence also shadows lower-precedence sequences that start with it, so a user's `g`
 * never waits behind a preset's `g e`.
 */
export function resolve(input: { shortcuts: readonly Shortcut[]; isMac: boolean }): Resolution {
  const entries = input.shortcuts
    .filter((shortcut) => shortcut.enabled)
    .flatMap((shortcut) => {
      const tokens = sequenceTokens(shortcut.keys, shortcut.keyMode, input.isMac);
      return tokens === null ? [] : [{ shortcut, tokens, rank: rankOf(shortcut) }];
    })
    // Array.prototype.sort is stable, so input order breaks ties within a rank.
    .sort((a, b) => b.rank - a.rank);

  const winners: typeof entries = [];
  const shadowed: Shadowed[] = [];
  for (const entry of entries) {
    const winner = winners.find(
      (w) =>
        w.shortcut.keyMode === entry.shortcut.keyMode &&
        (w.rank > entry.rank ? startsWith(entry.tokens, w.tokens) : sameTokens(entry.tokens, w.tokens)),
    );
    if (winner === undefined) winners.push(entry);
    else shadowed.push({ shortcut: entry.shortcut, by: winner.shortcut });
  }
  return { active: winners.map((w) => w.shortcut), shadowed };
}

function startsWith(tokens: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= tokens.length && prefix.every((token, i) => tokens[i] === token);
}

function sameTokens(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && startsWith(a, b);
}
