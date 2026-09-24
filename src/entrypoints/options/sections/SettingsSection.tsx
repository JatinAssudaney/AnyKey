import { useId, useState } from 'react';
import { card, checkbox, errorText, fieldLabel, hintText, sectionHeading, textInput } from '@/components/styles';
import { DEFAULT_SETTINGS } from '@/core/defaults';
import { effectiveSettings, type SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { SettingsSchema, type Settings } from '@/core/schema';

type NumberSetting = 'sequenceTimeoutMs' | 'scrollStep';

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
        <NumberField
          name="sequenceTimeoutMs"
          label="Time to finish a key sequence (milliseconds)"
          hint={`How long AnyKey waits for the next key of a sequence such as g g. Default: ${DEFAULT_SETTINGS.sequenceTimeoutMs}.`}
          value={settings.sequenceTimeoutMs}
          onCommit={(value) => {
            save({ sequenceTimeoutMs: value });
          }}
        />
        <NumberField
          name="scrollStep"
          label="Scroll distance (pixels)"
          hint={`How far one press of Scroll up or Scroll down moves. Default: ${DEFAULT_SETTINGS.scrollStep}.`}
          value={settings.scrollStep}
          onCommit={(value) => {
            save({ scrollStep: value });
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

interface NumberFieldProps {
  name: NumberSetting;
  label: string;
  hint: string;
  value: number;
  onCommit: (value: number) => void;
}

/** A whole-number setting, saved when focus leaves the field or Enter is pressed. */
function NumberField({ name, label, hint, value, onCommit }: NumberFieldProps) {
  const id = useId();
  /** What the user typed, until it is saved; null shows the stored value. */
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');

  function commit(): void {
    if (draft === null) return;
    const result = SettingsSchema.shape[name].safeParse(draft.trim() === '' ? Number.NaN : Number(draft));
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Enter a whole number.');
      return;
    }
    setError('');
    setDraft(null);
    if (result.data !== value) onCommit(result.data);
  }

  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        step={1}
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
        className={`${textInput} mt-1 max-w-32`}
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
