// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Shortcut } from '@/core/schema';
import { ShortcutTable } from './ShortcutTable';

function presetShortcut(label: string, verified: boolean): Shortcut {
  return {
    id: `preset:tube:${label.toLowerCase().replaceAll(' ', '-')}`,
    keys: 'g l',
    keyMode: 'key',
    action: { type: 'navigate', url: '/' },
    scope: { type: 'site', match: '*://tube.example/*' },
    label,
    source: 'preset',
    verified,
    enabled: true,
  };
}

describe('ShortcutTable', () => {
  afterEach(cleanup);

  // Every preset shortcut ships unverified until it is checked on the live site (docs/preset-checklist.md).
  it('marks the preset shortcuts not yet checked on the live site as Unverified', () => {
    render(
      <ShortcutTable
        caption="Tube preset shortcuts"
        shortcuts={[presetShortcut('Like the video', false), presetShortcut('Go home', true)]}
        conflicts={new Map()}
        onToggle={() => undefined}
        onEdit={() => undefined}
        extra={() => null}
      />,
    );
    expect(screen.getByRole('rowheader', { name: /^Like the video/ }).textContent).toContain('Unverified');
    expect(screen.getByRole('rowheader', { name: /^Go home/ }).textContent).not.toContain('Unverified');
  });
});
