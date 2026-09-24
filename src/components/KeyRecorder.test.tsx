// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyRecorder } from './KeyRecorder';

function setup(mode: 'key' | 'code' = 'key') {
  const onRecord = vi.fn<(keys: string) => void>();
  render(<KeyRecorder mode={mode} onRecord={onRecord} />);
  const button = screen.getByRole('button', { name: 'Record keys' });
  return { onRecord, button };
}

describe('KeyRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('records a sequence and finishes after a pause', () => {
    const { onRecord, button } = setup();
    fireEvent.click(button, { detail: 1 });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(fireEvent.keyDown(button, { key: 'g', code: 'KeyG' })).toBe(false);
    fireEvent.keyDown(button, { key: 'i', code: 'KeyI' });
    expect(onRecord).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onRecord).toHaveBeenCalledWith('g i');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('Recorded g i.');
  });

  it('cancels on Esc without closing whatever dialog it sits in', () => {
    const { onRecord, button } = setup();
    fireEvent.click(button, { detail: 1 });
    fireEvent.keyDown(button, { key: 'g', code: 'KeyG' });
    // A cancelled keydown is what keeps a <dialog> from closing on Esc.
    expect(fireEvent.keyDown(button, { key: 'Escape', code: 'Escape' })).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onRecord).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Recording cancelled.');
  });

  it('finishes on Enter, and on Tab without stopping focus from moving', () => {
    const { onRecord, button } = setup();
    fireEvent.click(button, { detail: 1 });
    fireEvent.keyDown(button, { key: 'G', code: 'KeyG', shiftKey: true });
    expect(fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })).toBe(false);
    expect(onRecord).toHaveBeenLastCalledWith('G');

    fireEvent.click(button, { detail: 1 });
    fireEvent.keyDown(button, { key: 'x', code: 'KeyX', ctrlKey: true });
    expect(fireEvent.keyDown(button, { key: 'Tab', code: 'Tab' })).toBe(true);
    expect(onRecord).toHaveBeenLastCalledWith('mod+x');
  });

  it('records physical keys in code mode', () => {
    const { onRecord, button } = setup('code');
    fireEvent.click(button, { detail: 1 });
    fireEvent.keyDown(button, { key: '?', code: 'Slash', shiftKey: true });
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
    expect(onRecord).toHaveBeenCalledWith('shift+Slash');
  });

  it('leaves keys alone until recording starts, and stops on a mouse click', () => {
    const { onRecord, button } = setup();
    expect(fireEvent.keyDown(button, { key: 'g', code: 'KeyG' })).toBe(true);
    fireEvent.click(button, { detail: 1 });
    fireEvent.keyDown(button, { key: 'g', code: 'KeyG' });
    fireEvent.click(button, { detail: 1 });
    expect(onRecord).toHaveBeenCalledWith('g');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
