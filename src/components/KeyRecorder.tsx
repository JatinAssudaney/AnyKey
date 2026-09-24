import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createRecorder, type Recorder, type RecorderStep } from '@/core/recorder';
import type { KeyMode } from '@/core/schema';
import { isMac } from './platform';
import { secondaryButton } from './styles';

interface KeyRecorderProps {
  mode: KeyMode;
  /** Gets the recorded keys in notation, such as "g i". Not called when Esc cancelled or nothing was pressed. */
  onRecord: (keys: string) => void;
  /** Ids of the elements that describe the keys field. */
  describedBy?: string;
}

/**
 * A toggle button that records a shortcut from key presses (rules in docs/design.md, "Options page"). It never
 * traps focus: Esc cancels, Tab finishes and moves on, and Enter or a pause finishes.
 */
export function KeyRecorder({ mode, onRecord, describedBy }: KeyRecorderProps) {
  const recorder = useRef<Recorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  /** The keys so far, or null when not recording. */
  const [keys, setKeys] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  function handle(step: RecorderStep): void {
    clearTimeout(timer.current);
    const { state } = step;
    if (state.status === 'recording') {
      setKeys(state.keys);
      const active = recorder.current;
      if (step.wait !== null && active !== null) {
        timer.current = window.setTimeout(() => {
          handle(active.timeout());
        }, step.wait);
      }
      return;
    }
    recorder.current = null;
    setKeys(null);
    if (state.status === 'cancelled') {
      setAnnouncement('Recording cancelled.');
    } else if (state.keys === '') {
      setAnnouncement('Nothing recorded.');
    } else {
      setAnnouncement(`Recorded ${state.keys}.`);
      onRecord(state.keys);
    }
  }

  function onClick(event: MouseEvent<HTMLButtonElement>): void {
    const active = recorder.current;
    if (active === null) {
      recorder.current = createRecorder({ mode, isMac });
      setKeys('');
      setAnnouncement('Recording. Press the keys, then pause. Esc cancels.');
    } else if (event.detail > 0) {
      // A mouse click stops recording. Keyboard clicks can't: Space and Enter are keys to record or finish with.
      handle(active.timeout());
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const active = recorder.current;
    if (active === null || event.nativeEvent.isComposing) return;
    const step = active.keyDown(
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        altGraph: event.getModifierState('AltGraph'),
      },
      event.repeat,
    );
    // Consumed keys don't type, click the button or close the dialog around it (Esc).
    if (step.consume) event.preventDefault();
    event.stopPropagation();
    handle(step);
  }

  function onBlur(): void {
    const active = recorder.current;
    if (active !== null) handle(active.blur());
  }

  const recording = keys !== null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={recording}
        aria-describedby={describedBy}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className={`${secondaryButton} shrink-0 aria-pressed:border-red-700 aria-pressed:bg-red-50 dark:aria-pressed:border-red-400 dark:aria-pressed:bg-red-950`}
      >
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${recording ? 'animate-pulse bg-red-600 motion-reduce:animate-none' : 'bg-stone-400'}`}
        />
        Record keys
      </button>
      {recording && (
        <span aria-hidden="true" className="text-sm text-stone-700 dark:text-stone-300">
          {keys === '' ? 'Press keys…' : `${keys}…`}
        </span>
      )}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}
