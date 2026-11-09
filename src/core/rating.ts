import { z } from 'zod/mini';

// When AnyKey asks for a rating, at most twice (rules in docs/design.md, "Popup"). The count stays on this device.

export const RATING_KEY = 'rating';

/** Uses before AnyKey asks. Counting stops here, so storage is left alone from then on. */
export const RATING_USES = 10;
/** Time from the first use to the first ask: two days. */
export const RATING_WAIT_MS = 2 * 24 * 60 * 60 * 1000;
/** Time from "Not now" to the second and last ask: fourteen days. */
export const RATING_SECOND_WAIT_MS = 14 * 24 * 60 * 60 * 1000;

export const RatingSchema = z.object({
  uses: z.int().check(z.gte(0)),
  /** When this count started, in milliseconds. */
  since: z.number(),
  /** The person said "Not now" once, so the next ask is the last. */
  snoozed: z.optional(z.boolean()),
  /** AnyKey never asks again. */
  done: z.optional(z.boolean()),
});
export type Rating = z.infer<typeof RatingSchema>;

/** The state after one more use, or null when there is nothing to save. */
export function countUse(rating: Rating | null, now: number): Rating | null {
  if (rating === null) return { uses: 1, since: now };
  if (rating.done === true || rating.uses >= RATING_USES) return null;
  return { ...rating, uses: rating.uses + 1 };
}

/** The state after an answer: rating ends it, and "Not now" allows one more ask. */
export function answerRating(rating: Rating | null, rated: boolean, now: number): Rating {
  if (rated || rating?.snoozed === true) return { ...(rating ?? { uses: 0, since: now }), done: true };
  return { uses: 0, since: now, snoozed: true };
}

export function shouldAskForRating(rating: Rating | null, now: number): boolean {
  if (rating === null || rating.done === true || rating.uses < RATING_USES) return false;
  return now - rating.since >= (rating.snoozed === true ? RATING_SECOND_WAIT_MS : RATING_WAIT_MS);
}
