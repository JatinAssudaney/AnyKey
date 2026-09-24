import { describe, expect, it } from 'vitest';
import { actionOf, choiceValue, describeAction, findChoice } from './actions';

const FIELDS = { url: '', newTab: false, target: { selector: '' } };

describe('link hint choices', () => {
  it('turn into hint actions and back', () => {
    expect(actionOf('hints', FIELDS)).toEqual({ type: 'hints' });
    expect(actionOf('hints:newTab', FIELDS)).toEqual({ type: 'hints', newTab: true });
    expect(choiceValue({ type: 'hints' })).toBe('hints');
    expect(choiceValue({ type: 'hints', newTab: false })).toBe('hints');
    expect(choiceValue({ type: 'hints', newTab: true })).toBe('hints:newTab');
  });

  it('describe what they do', () => {
    expect(describeAction({ type: 'hints' })).toBe(findChoice('hints')?.name);
    expect(describeAction({ type: 'hints', newTab: true })).toBe('Show link hints to open in a new tab');
  });
});
