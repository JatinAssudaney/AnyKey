import { describe, expect, it } from 'vitest';
import { countUse, finishRating, RATING_USES, RATING_WAIT_MS, shouldAskForRating } from './rating';

describe('rating', () => {
  it('counts from the first use and stops at the threshold', () => {
    expect(countUse(null, 5)).toEqual({ uses: 1, since: 5 });
    expect(countUse({ uses: 3, since: 5 }, 9)).toEqual({ uses: 4, since: 5 });
    expect(countUse({ uses: RATING_USES, since: 5 }, 9)).toBeNull();
    expect(countUse({ uses: 3, since: 5, done: true }, 9)).toBeNull();
  });

  it('asks only after enough uses and enough time, and never once answered', () => {
    const uses = RATING_USES;
    expect(shouldAskForRating(null, RATING_WAIT_MS)).toBe(false);
    expect(shouldAskForRating({ uses: uses - 1, since: 0 }, RATING_WAIT_MS)).toBe(false);
    expect(shouldAskForRating({ uses, since: 0 }, RATING_WAIT_MS - 1)).toBe(false);
    expect(shouldAskForRating({ uses, since: 0 }, RATING_WAIT_MS)).toBe(true);
    expect(shouldAskForRating(finishRating({ uses, since: 0 }, 1), RATING_WAIT_MS)).toBe(false);
  });
});
