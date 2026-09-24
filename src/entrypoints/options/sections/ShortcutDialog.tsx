import { useId, useRef, useState, type SubmitEvent } from 'react';
import { conflictText } from '@/components/conflictText';
import { Dialog } from '@/components/Dialog';
import { KeyRecorder } from '@/components/KeyRecorder';
import { isMac } from '@/components/platform';
import {
  checkbox,
  errorText,
  fieldLabel,
  hintText,
  primaryButton,
  secondaryButton,
  textInput,
} from '@/components/styles';
import { findConflicts } from '@/core/conflicts';
import type { SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { effectiveDefaults } from '@/core/resolve';
import { LIMITS, ShortcutSchema, type KeyMode, type Shortcut } from '@/core/schema';
import { applyMutation } from '@/storage/mutations';
import { ACTION_GROUPS, actionOf, choiceValue, describeAction, NAVIGATE } from '../actions';

/** What the dialog edits: a new shortcut of the user's, an existing one, or the keys of a built-in shortcut. */
export type Editing = { kind: 'new' } | { kind: 'user'; shortcut: Shortcut } | { kind: 'default'; shortcut: Shortcut };

interface Errors {
  label?: string;
  keys?: string;
  url?: string;
  form?: string;
}

interface ShortcutDialogProps {
  editing: Editing;
  data: SyncData;
  /** Gets a mutation that `applyMutation` accepted against `data`. */
  onSave: (mutation: Mutation) => void;
  onClose: () => void;
}

export function ShortcutDialog({ editing, data, onSave, onClose }: ShortcutDialogProps) {
  const original = editing.kind === 'new' ? null : editing.shortcut;
  const builtIn = editing.kind === 'default';
  const [id] = useState(() => original?.id ?? `user:${crypto.randomUUID()}`);
  const [choice, setChoice] = useState(() => (original === null ? 'scroll:down' : choiceValue(original.action)));
  const [url, setUrl] = useState(original?.action.type === 'navigate' ? original.action.url : '');
  const [newTab, setNewTab] = useState(original?.action.type === 'navigate' && original.action.newTab === true);
  const [label, setLabel] = useState(original?.label ?? '');
  const [keys, setKeys] = useState(original?.keys ?? '');
  const [keyMode, setKeyMode] = useState<KeyMode>(original?.keyMode ?? 'key');
  const [allowInInputs, setAllowInInputs] = useState(original?.allowInInputs === true);
  const [errors, setErrors] = useState<Errors>({});
  const labelRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const keysRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  function candidate(): Shortcut {
    if (original !== null && builtIn) return { ...original, keys: keys.trim(), keyMode };
    const action =
      choice === null && original !== null ? original.action : actionOf(choice ?? NAVIGATE, { url, newTab });
    return {
      id,
      keys: keys.trim(),
      keyMode,
      action,
      scope: { type: 'global' },
      // An empty name falls back to what the shortcut does.
      label: label.trim() || truncate(describeAction(action), LIMITS.label),
      ...(allowInInputs ? { allowInInputs: true } : {}),
      source: 'user',
      enabled: original?.enabled ?? true,
    };
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const shortcut = candidate();
    const found: Errors = {};
    const parsed = ShortcutSchema.safeParse(shortcut);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [field, detail] = issue.path;
        if (field === 'label') found.label ??= issue.message;
        else if (field === 'keys') found.keys ??= issue.message;
        else if (field === 'action' && detail === 'url') found.url ??= issue.message;
        else found.form ??= 'Check the shortcut and try again.';
      }
    }
    const mutation: Mutation = builtIn
      ? { op: 'setDefault', id: shortcut.id, keys: shortcut.keys, keyMode }
      : { op: 'saveShortcut', shortcut };
    if (Object.keys(found).length === 0) {
      const result = applyMutation(data, mutation);
      if (!result.ok) found.form = result.error;
    }
    setErrors(found);
    if (found.url !== undefined) urlRef.current?.focus();
    else if (found.label !== undefined) labelRef.current?.focus();
    else if (found.keys !== undefined) keysRef.current?.focus();
    if (Object.keys(found).length > 0) return;
    onSave(mutation);
    onClose();
  }

  // Conflicts as if the shortcut were on: the user is choosing its keys.
  const shortcut = { ...candidate(), enabled: true };
  const others = [...effectiveDefaults(data.state), ...data.state.global.shortcuts];
  const all = others.some((s) => s.id === shortcut.id)
    ? others.map((s) => (s.id === shortcut.id ? shortcut : s))
    : [...others, shortcut];
  const conflicts = findConflicts(all, isMac).get(shortcut.id) ?? [];

  const title = original === null ? 'Add a shortcut' : `Edit "${original.label}"`;
  const keysHint = `${ids}-keys-hint`;
  const keysError = `${ids}-keys-error`;
  const conflictsId = `${ids}-conflicts`;
  const keysDescribedBy = [keysHint, conflicts.length > 0 ? conflictsId : '', errors.keys ? keysError : '']
    .filter(Boolean)
    .join(' ');

  return (
    <Dialog title={title} onClose={onClose}>
      <form noValidate onSubmit={onSubmit} className="mt-4 space-y-5">
        {errors.form !== undefined && (
          <p role="alert" className={errorText}>
            {errors.form}
          </p>
        )}

        {builtIn || choice === null ? (
          <div>
            <p className={fieldLabel}>Action</p>
            <p className="mt-1 text-sm">{original === null ? '' : describeAction(original.action)}</p>
          </div>
        ) : (
          <div>
            <label htmlFor={`${ids}-action`} className={fieldLabel}>
              Action
            </label>
            <select
              id={`${ids}-action`}
              value={choice}
              onChange={(event) => {
                setChoice(event.target.value);
              }}
              className={`${textInput} mt-1`}
            >
              {ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.choices.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {!builtIn && choice === NAVIGATE && (
          <div className="space-y-3">
            <div>
              <label htmlFor={`${ids}-url`} className={fieldLabel}>
                Web address
              </label>
              <input
                ref={urlRef}
                id={`${ids}-url`}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                }}
                aria-invalid={errors.url !== undefined}
                aria-describedby={`${ids}-url-hint${errors.url ? ` ${ids}-url-error` : ''}`}
                className={`${textInput} mt-1`}
              />
              <p id={`${ids}-url-hint`} className={hintText}>
                A full address such as https://example.com, or a path on the current site such as /notifications.
              </p>
              {errors.url !== undefined && (
                <p id={`${ids}-url-error`} className={errorText}>
                  {errors.url}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newTab}
                onChange={(event) => {
                  setNewTab(event.target.checked);
                }}
                className={checkbox}
              />
              Open in a new tab
            </label>
          </div>
        )}

        {!builtIn && (
          <div>
            <label htmlFor={`${ids}-label`} className={fieldLabel}>
              Name
            </label>
            <input
              ref={labelRef}
              id={`${ids}-label`}
              type="text"
              autoComplete="off"
              maxLength={LIMITS.label}
              value={label}
              placeholder={candidate().label}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
              aria-invalid={errors.label !== undefined}
              aria-describedby={`${ids}-label-hint${errors.label ? ` ${ids}-label-error` : ''}`}
              className={`${textInput} mt-1`}
            />
            <p id={`${ids}-label-hint`} className={hintText}>
              Shown in the list of shortcuts that ? opens. Leave it empty to describe the action.
            </p>
            {errors.label !== undefined && (
              <p id={`${ids}-label-error`} className={errorText}>
                {errors.label}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor={`${ids}-keys`} className={fieldLabel}>
            Keys
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              ref={keysRef}
              id={`${ids}-keys`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              value={keys}
              onChange={(event) => {
                setKeys(event.target.value);
              }}
              aria-invalid={errors.keys !== undefined}
              aria-describedby={keysDescribedBy}
              className={`${textInput} max-w-48 font-mono`}
            />
            <KeyRecorder
              mode={keyMode}
              describedBy={keysDescribedBy}
              onRecord={(recorded) => {
                setKeys(recorded);
                setErrors((current) => ({ ...current, keys: undefined }));
              }}
            />
          </div>
          <p id={keysHint} className={hintText}>
            Type keys such as <code>g i</code>, <code>shift+x</code> or <code>mod+k</code> (mod is ⌘ on a Mac and Ctrl
            elsewhere), or record them.
          </p>
          {errors.keys !== undefined && (
            <p id={keysError} className={errorText}>
              {errors.keys}
            </p>
          )}
          {conflicts.length > 0 && (
            <ul id={conflictsId} className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-300">
              {conflicts.map((conflict, i) => (
                <li key={i}>
                  <span aria-hidden="true">⚠ </span>
                  {conflictText(conflict)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor={`${ids}-mode`} className={fieldLabel}>
            Match keys by
          </label>
          <select
            id={`${ids}-mode`}
            value={keyMode}
            onChange={(event) => {
              setKeyMode(event.target.value === 'code' ? 'code' : 'key');
            }}
            aria-describedby={`${ids}-mode-hint`}
            className={`${textInput} mt-1 max-w-64`}
          >
            <option value="key">The character typed</option>
            <option value="code">The physical key</option>
          </select>
          <p id={`${ids}-mode-hint`} className={hintText}>
            Physical keys are written as codes such as <code>KeyG</code> and stay put when the keyboard layout changes.
          </p>
        </div>

        {!builtIn && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowInInputs}
              onChange={(event) => {
                setAllowInInputs(event.target.checked);
              }}
              className={checkbox}
            />
            Also works while typing in text fields
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** At most `max` UTF-16 units, without splitting a surrogate pair. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut}…`;
}
