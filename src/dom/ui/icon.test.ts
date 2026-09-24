// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import source from '../../assets/icon.svg?raw';
import { anyKeyIcon } from './icon';

interface Drawn {
  tag: string;
  attributes: Record<string, string>;
  children: Drawn[];
}

function drawn(element: Element): Drawn {
  return {
    tag: element.localName,
    attributes: Object.fromEntries(
      [...element.attributes].filter(({ name }) => name !== 'xmlns').map(({ name, value }) => [name, value]),
    ),
    children: [...element.children].map(drawn),
  };
}

describe('anyKeyIcon', () => {
  it('draws the toolbar icon, src/assets/icon.svg', () => {
    const file = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
    const icon = anyKeyIcon();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    icon.removeAttribute('class');
    icon.removeAttribute('aria-hidden');
    expect(drawn(icon)).toEqual(drawn(file));
  });
});
