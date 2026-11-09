import { describe, expect, it } from 'vitest';
import {
  answerRating,
  countUse,
  RATING_SECOND_WAIT_MS,
  RATING_USES,
  RATING_WAIT_MS,
  shouldAskForRating,
} from './rating';

describe('rating', () => {
  it('counts from the first use and stops at the threshold', () => {
    expect(countUse(null, 5)).toEqual({ uses: 1, since: 5 });
    expect(countUse({ uses: 3, since: 5 }, 9)).toEqual({ uses: 4, since: 5 });
    expect(countUse({ uses: RATING_USES, since: 5 }, 9)).toBeNull();
    expect(countUse({ uses: 3, since: 5, done: true }, 9)).toBeNull();
  });

  it('asks only after enough uses and enough time', () => {
    const uses = RATING_USES;
    expect(shouldAskForRating(null, RATING_WAIT_MS)).toBe(false);
    expect(shouldAskForRating({ uses: uses - 1, since: 0 }, RATING_WAIT_MS)).toBe(false);
    expect(shouldAskForRating({ uses, since: 0 }, RATING_WAIT_MS - 1)).toBe(false);
    expect(shouldAskForRating({ uses, since: 0 }, RATING_WAIT_MS)).toBe(true);
  });

  it('never asks again after a rating', () => {
    const done = answerRating({ uses: RATING_USES, since: 0 }, true, 1);
    expect(done.done).toBe(true);
    expect(shouldAskForRating(done, RATING_SECOND_WAIT_MS * 2)).toBe(false);
  });

  it('asks once more after Not now, and stops after a second one', () => {
    const later = answerRating({ uses: RATING_USES, since: 0 }, false, 100);
    expect(later).toEqual({ uses: 0, since: 100, snoozed: true });
    const used = { ...later, uses: RATING_USES };
    expect(shouldAskForRating(used, 100 + RATING_SECOND_WAIT_MS - 1)).toBe(false);
    expect(shouldAskForRating(used, 100 + RATING_SECOND_WAIT_MS)).toBe(true);
    const last = answerRating(used, false, 200);
    expect(last.done).toBe(true);
    expect(shouldAskForRating(last, RATING_SECOND_WAIT_MS * 2)).toBe(false);
  });
});
