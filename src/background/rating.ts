import { browser } from 'wxt/browser';
import { countUse, finishRating, RATING_KEY } from '../core/rating';
import { loadRating } from '../storage/read';

// ponytail: read then write, so two uses at the same moment can count as one, which a threshold of 25 doesn't feel.

export async function recordUse(): Promise<void> {
  const next = countUse(await loadRating(), Date.now());
  if (next !== null) await browser.storage.local.set({ [RATING_KEY]: next });
}

export async function recordRatingAnswer(): Promise<void> {
  await browser.storage.local.set({ [RATING_KEY]: finishRating(await loadRating(), Date.now()) });
}
