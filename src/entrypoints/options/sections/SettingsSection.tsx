import { useId, useState } from 'react';
import { card, checkbox, errorText, fieldLabel, hintText, sectionHeading, textInput } from '@/components/styles';
import { DEFAULT_SETTINGS } from '@/core/defaults';
import { effectiveSettings, type SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { SettingsSchema, type Settings } from '@/core/schema';

/** What was typed into a setting's field: the value to save, or why it can't be saved. */
type Checked<T> = { value: T } | { error: string };

interface SettingsSectionProps {
  data: SyncData;
  mutate: (mutation: Mutation) => Promise<string | null>;
}

export function SettingsSection({ data, mutate }: SettingsSectionProps) {
  const settings = effectiveSettings(data.state);
  const save = (change: Partial<Settings>): void => {
    void mutate({ op: 'setSettings', settings: change });
  };

  return (
    <section aria-labelledby="settings-heading" className={card}>
      <h2 id="settings-heading" className={sectionHeading}>
        Settings
      </h2>
      <div className="mt-4 space-y-5">
        <SettingField
          numeric
          label="Time to finish a key sequence (milliseconds)"
          hint={`How long AnyKey waits for the next key of a sequence such as g g. Default: ${DEFAULT_SETTINGS.sequenceTimeoutMs}.`}
          value={settings.sequenceTimeoutMs}
          check={(draft) => checkSetting('sequenceTimeoutMs', toNumber(draft))}
          onCommit={(value) => {
            save({ sequenceTimeoutMs: value });
          }}
        />
        <SettingField
          numeric
          label="Scroll distance (pixels)"
          hint={`How far one press of Scroll up or Scroll down moves. Default: ${DEFAULT_SETTINGS.scrollStep}.`}
          value={settings.scrollStep}
          check={(draft) => checkSetting('scrollStep', toNumber(draft))}
          onCommit={(value) => {
            save({ scrollStep: value });
          }}
        />
        <SettingField
          label="Hint characters"
          hint={`The keys that link hints are labeled with, the easiest to reach first. They pick labels only while hints show, and run your shortcuts the rest of the time. Default: ${DEFAULT_SETTINGS.hintChars}.`}
          value={settings.hintChars}
          check={(draft) => checkSetting('hintChars', draft.trim().toLowerCase())}
          onCommit={(value) => {
            save({ hintChars: value });
          }}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.smoothScroll}
            onChange={(event) => {
              save({ smoothScroll: event.target.checked });
            }}
            className={checkbox}
          />
          Smooth scrolling
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.newTabInBackground}
            onChange={(event) => {
              save({ newTabInBackground: event.target.checked });
            }}
            className={checkbox}
          />
          Open new tabs behind the current tab
        </label>
      </div>
    </section>
  );
}

interface SettingFieldProps<T extends number | string> {
  label: string;
  hint: string;
  value: T;
  check: (draft: string) => Checked<T>;
  onCommit: (value: T) => void;
  /** A whole number rather than text. */
  numeric?: boolean;
}

/** A setting typed into a field, saved when focus leaves the field or Enter is pressed. */
function SettingField<T extends number | string>({
  label,
  hint,
  value,
  check,
  onCommit,
  numeric = false,
}: SettingFieldProps<T>) {
  const id = useId();
  /** What the user typed, until it is saved; null shows the stored value. */
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');

  function commit(): void {
    if (draft === null) return;
    const checked = check(draft);
    if ('error' in checked) {
      setError(checked.error);
      return;
    }
    setError('');
    setDraft(null);
    if (checked.value !== value) onCommit(checked.value);
  }

  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'numeric' : undefined}
        step={numeric ? 1 : undefined}
        autoComplete="off"
        spellCheck={false}
        value={draft ?? String(value)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
        aria-invalid={error !== ''}
        aria-describedby={`${id}-hint${error === '' ? '' : ` ${id}-error`}`}
        className={`${textInput} mt-1 ${numeric ? 'max-w-32' : 'max-w-64 font-mono'}`}
      />
      <p id={`${id}-hint`} className={hintText}>
        {hint}
      </p>
      {/* An alert: focus has often left the field (on blur), and a changed description isn't read again. */}
      {error !== '' && (
        <p id={`${id}-error`} role="alert" className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}

/** An empty field is no number, rather than 0. */
function toNumber(draft: string): number {
  return draft.trim() === '' ? Number.NaN : Number(draft);
}

/** Checks a typed value against the setting's schema. */
function checkSetting<K extends 'sequenceTimeoutMs' | 'scrollStep' | 'hintChars'>(
  name: K,
  value: unknown,
): Checked<Settings[K]> {
  const result = SettingsSchema.shape[name].safeParse(value);
  if (result.success) return { value: result.data as Settings[K] };
  return { error: result.error.issues[0]?.message ?? 'Check this value.' };
}
