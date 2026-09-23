import { describe, expect, it } from 'vitest';
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from './app';

describe('manifest strings', () => {
  it('fit the limits Chrome enforces', () => {
    expect(APP_NAME.length).toBeLessThanOrEqual(75);
    expect(APP_SHORT_NAME.length).toBeLessThanOrEqual(12);
    expect(APP_DESCRIPTION.length).toBeLessThanOrEqual(132);
  });
});
