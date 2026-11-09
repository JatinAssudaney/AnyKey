import { z } from 'zod/mini';

// When the popup asks for a rating, once (rules in docs/design.md, "Popup"). The count stays on this device.

export const RATING_KEY = 'rating';

/** Uses before AnyKey asks. Counting stops here, so storage is left alone from then on. */
export const RATING_USES = 25;
/** Time since the first use before AnyKey asks: three days. */
export const RATING_WAIT_MS = 3 * 24 * 60 * 60 * 1000;

export const RatingSchema = z.object({
  uses: z.int().check(z.gte(0)),
  /** When the first use was counted, in milliseconds. */
  since: z.number(),
  /** The person answered: AnyKey never asks again. */
  done: z.optional(z.boolean()),
});
export type Rating = z.infer<typeof RatingSchema>;

/** The state after one more use, or null when there is nothing to save. */
export function countUse(rating: Rating | null, now: number): Rating | null {
  if (rating === null) return { uses: 1, since: now };
  if (rating.done === true || rating.uses >= RATING_USES) return null;
  return { ...rating, uses: rating.uses + 1 };
}

export function finishRating(rating: Rating | null, now: number): Rating {
  return { ...(rating ?? { uses: 0, since: now }), done: true };
}

export function shouldAskForRating(rating: Rating | null, now: number): boolean {
  return (
    rating !== null && rating.done !== true && rating.uses >= RATING_USES && now - rating.since >= RATING_WAIT_MS
  );
}
