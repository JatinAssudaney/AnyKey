/**
 * Labels for `count` link hints, made of the characters in `chars`, the most comfortable first. No label is the
 * start of another, so a hint is picked the moment its last character is typed. Labels are as short as they can
 * be: they all have the same length or one more, as few as possible have the extra character, and those start
 * with the least comfortable characters. A repeated character counts once, and fewer than 2 characters make no
 * labels.
 */
export function hintLabels(count: number, chars: string): string[] {
  const alphabet = [...new Set(chars)];
  const size = alphabet.length;
  if (count < 1 || size < 2) return [];
  if (count <= size) return alphabet.slice(0, count);
  // Every string one character shorter than the longest labels, most comfortable first.
  let prefixes = alphabet;
  while (prefixes.length * size < count) {
    prefixes = prefixes.flatMap((prefix) => alphabet.map((char) => prefix + char));
  }
  // From the least comfortable end, each prefix becomes a group of longer labels until there are enough.
  const labels: string[] = [];
  let missing = count - prefixes.length;
  for (const prefix of prefixes.toReversed()) {
    if (missing === 0) {
      labels.push(prefix);
      continue;
    }
    const group = alphabet.slice(0, Math.min(size, missing + 1)).map((char) => prefix + char);
    labels.push(...group.toReversed());
    missing -= group.length - 1;
  }
  return labels.toReversed();
}
