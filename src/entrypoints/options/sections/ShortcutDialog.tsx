import { useId, useRef, useState, type SubmitEvent } from 'react';
import { Dialog } from '@/components/Dialog';
import { focusAfterRender } from '@/components/focus';
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
import { describeConflicts, findConflicts } from '@/core/conflicts';
import type { SyncData } from '@/core/docs';
import type { Mutation } from '@/core/messages';
import { presetOverride, type Preset, type PresetShortcut } from '@/core/presets';
import { effectiveDefaults, shortcutsOnSite } from '@/core/resolve';
import { LIMITS, ShortcutSchema, type ElementTarget, type KeyMode, type Shortcut } from '@/core/schema';
import { truncate } from '@/core/text';
import { isHost, siteMatch } from '@/core/url';
import { applyMutation } from '@/storage/mutations';
import { ACTION_GROUPS, actionOf, choiceValue, CLICK, describeAction, FOCUS, NAVIGATE } from '../actions';
import { isValidSelector, normalizeHost } from '../fields';
import { editButtonId } from './ShortcutTable';

/**
 * What the dialog edits: a new shortcut of the user's (for one site, when `site` is set), an existing one with the
 * site whose settings keep it, or the keys of a built-in shortcut or of a preset's shortcut (`base`, as the preset
 * has it) on one of the preset's sites.
 */
export type Editing =
  | { kind: 'new'; site?: string }
  | { kind: 'user'; shortcut: Shortcut; site?: string }
  | { kind: 'default'; shortcut: Shortcut }
  | { kind: 'preset'; shortcut: Shortcut; base: PresetShortcut; preset: Preset; site: string };

interface Errors {
  label?: string;
  keys?: string;
  url?: string;
  host?: string;
  pages?: string;
  selector?: string;
  text?: string;
  form?: string;
}

interface ShortcutDialogProps {
  editing: Editing;
  data: SyncData;
  /** The installed presets, for conflicts with their shortcuts and their sites' own keys. */
  presets: readonly Preset[];
  /** Gets a mutation that `applyMutation` accepted against `data`. */
  onSave: (mutation: Mutation) => void;
  onClose: () => void;
}

export function ShortcutDialog({ editing, data, presets, onSave, onClose }: ShortcutDialogProps) {
  const original = editing.kind === 'new' ? null : editing.shortcut;
  // Only the keys of a built-in or preset shortcut can change.
  const keysOnly = editing.kind === 'default' || editing.kind === 'preset';
  const originalSite = editing.kind === 'default' ? undefined : editing.site;
  const originalTarget =
    original?.action.type === 'click' || original?.action.type === 'focus' ? original.action.target : null;
  const [id] = useState(() => original?.id ?? `user:${crypto.randomUUID()}`);
  const [choice, setChoice] = useState(() =>
    original === null ? (originalSite === undefined ? 'scroll:down' : CLICK) : choiceValue(original.action),
  );
  const [url, setUrl] = useState(original?.action.type === 'navigate' ? original.action.url : '');
  const [newTab, setNewTab] = useState(
    (original?.action.type === 'navigate' || original?.action.type === 'click') && original.action.newTab === true,
  );
  const [selector, setSelector] = useState(originalTarget?.selector ?? '');
  const [text, setText] = useState(originalTarget?.text ?? '');
  const [where, setWhere] = useState<'global' | 'site'>(originalSite === undefined ? 'global' : 'site');
  const [host, setHost] = useState(originalSite ?? '');
  // Null while the pages follow the site: every page of it.
  const [pages, setPages] = useState<string | null>(() =>
    original?.scope.type === 'site' && original.scope.match !== siteMatch(originalSite ?? '')
      ? original.scope.match
      : null,
  );
  const [label, setLabel] = useState(original?.label ?? '');
  const [keys, setKeys] = useState(original?.keys ?? '');
  const [keyMode, setKeyMode] = useState<KeyMode>(original?.keyMode ?? 'key');
  const [allowInInputs, setAllowInInputs] = useState(original?.allowInInputs === true);
  const [errors, setErrors] = useState<Errors>({});
  const labelRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const keysRef = useRef<HTMLInputElement>(null);
  const hostRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<HTMLInputElement>(null);
  const selectorRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  const site = where === 'site' ? normalizeHost(host) : '';
  const pagesValue = pages ?? (isHost(site) ? siteMatch(site) : '');
  const element = choice === CLICK || choice === FOCUS;

  function target(): ElementTarget {
    const trimmed = selector.trim();
    // The picker's fallbacks and tag describe the element its selector found, so they go when the selector changes.
    const result: ElementTarget = originalTarget?.selector === trimmed ? { ...originalTarget } : { selector: trimmed };
    delete result.text;
    if (text.trim() !== '') result.text = text.trim();
    return result;
  }

  function candidate(): Shortcut {
    if (original !== null && keysOnly) return { ...original, keys: keys.trim(), keyMode };
    const action =
      choice === null && original !== null
        ? original.action
        : actionOf(choice ?? NAVIGATE, { url, newTab, target: target() });
    return {
      id,
      keys: keys.trim(),
      keyMode,
      action,
      scope: where === 'site' ? { type: 'site', match: pagesValue.trim() } : { type: 'global' },
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
    if (where === 'site' && !keysOnly && !isHost(site)) found.host = 'Enter a site such as github.com.';
    if (element) {
      if (selector.trim() === '') found.selector = 'Enter a CSS selector for the element.';
      else if (!isValidSelector(selector)) found.selector = "This isn't a CSS selector AnyKey can use.";
    }
    const parsed = ShortcutSchema.safeParse(shortcut);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [field, detail, part] = issue.path;
        if (field === 'label') found.label ??= issue.message;
        else if (field === 'keys') found.keys ??= issue.message;
        else if (field === 'action' && detail === 'url') found.url ??= issue.message;
        else if (field === 'action' && detail === 'target' && part === 'selector') found.selector ??= 'Use a shorter selector.';
        else if (field === 'action' && detail === 'target' && part === 'text') found.text ??= 'Use shorter text.';
        else if (field === 'scope') found.pages ??= issue.message;
        else found.form ??= 'Check the shortcut and try again.';
      }
    }
    const mutation: Mutation =
      editing.kind === 'default'
        ? { op: 'setDefault', id: shortcut.id, keys: shortcut.keys, keyMode }
        : editing.kind === 'preset'
          ? {
              op: 'setPresetOverride',
              preset: editing.preset.id,
              id: shortcut.id,
              override: presetOverride(editing.base, data.state.presets.get(editing.preset.id)?.get(shortcut.id), {
                keys: shortcut.keys,
                keyMode,
              }),
            }
          : { op: 'saveShortcut', shortcut, ...(where === 'site' ? { site } : {}) };
    if (Object.keys(found).length === 0) {
      const result = applyMutation(data, mutation);
      if (!result.ok) found.form = result.error;
    }
    setErrors(found);
    // Focus goes to the first field with a problem, in the order the form shows them.
    const fields = [
      [found.host, hostRef],
      [found.pages, pagesRef],
      [found.selector, selectorRef],
      [found.text, textRef],
      [found.url, urlRef],
      [found.label, labelRef],
      [found.keys, keysRef],
    ] as const;
    fields.find(([problem]) => problem !== undefined)?.[1].current?.focus();
    if (Object.keys(found).length > 0) return;
    onSave(mutation);
    onClose();
    // Focus follows the shortcut when it may not be where the dialog was opened: saving can move it to another table
    // (to another site, or between a site and every site), and a new one can go to another site than the one it was
    // added from, or come from "Add a site shortcut", which sits above every site.
    const savedSite = where === 'site' ? site : undefined;
    if (!keysOnly && (original !== null || savedSite !== originalSite)) {
      focusAfterRender(() => document.getElementById(editButtonId(shortcut)));
    }
  }

  // Conflicts as if the shortcut were on, among the shortcuts that can run together with it, and for a shortcut on
  // one site, with the site's own keys.
  const shortcut = { ...candidate(), enabled: true };
  const onSite = where === 'site' ? shortcutsOnSite(data.state, presets, site) : null;
  const others = (onSite?.shortcuts ?? [...effectiveDefaults(data.state), ...data.state.global.shortcuts]).filter(
    (other) => other.id !== shortcut.id,
  );
  const conflicts = describeConflicts(findConflicts([...others, shortcut], isMac, onSite?.native).get(shortcut.id) ?? []);

  const title =
    original !== null
      ? `Edit "${original.label}"`
      : originalSite === undefined || originalSite === ''
        ? 'Add a shortcut'
        : `Add a shortcut for ${originalSite}`;
  const keysHint = `${ids}-keys-hint`;
  const keysError = `${ids}-keys-error`;
  const conflictsId = `${ids}-conflicts`;
  const keysDescribedBy = [keysHint, conflicts.length > 0 ? conflictsId : '', errors.keys ? keysError : '']
    .filter(Boolean)
    .join(' ');
  const describedBy = (field: keyof Errors, hint = true): string =>
    [hint ? `${ids}-${field}-hint` : '', errors[field] ? `${ids}-${field}-error` : ''].filter(Boolean).join(' ');
  const errorFor = (field: keyof Errors) =>
    errors[field] !== undefined && (
      <p id={`${ids}-${field}-error`} className={errorText}>
        {errors[field]}
      </p>
    );

  return (
    <Dialog title={title} onClose={onClose}>
      <form noValidate onSubmit={onSubmit} className="mt-4 space-y-5">
        {errors.form !== undefined && (
          <p role="alert" className={errorText}>
            {errors.form}
          </p>
        )}

        {!keysOnly && (
          <div>
            <label htmlFor={`${ids}-where`} className={fieldLabel}>
              Works on
            </label>
            <select
              id={`${ids}-where`}
              value={where}
              onChange={(event) => {
                setWhere(event.target.value === 'site' ? 'site' : 'global');
              }}
              className={`${textInput} mt-1 max-w-64`}
            >
              <option value="global">Every site</option>
              <option value="site">One site</option>
            </select>
          </div>
        )}

        {!keysOnly && where === 'site' && (
          <div className="space-y-3">
            <div>
              <label htmlFor={`${ids}-host`} className={fieldLabel}>
                Site
              </label>
              <input
                ref={hostRef}
                id={`${ids}-host`}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={host}
                onChange={(event) => {
                  setHost(event.target.value);
                }}
                aria-invalid={errors.host !== undefined}
                aria-describedby={describedBy('host')}
                className={`${textInput} mt-1`}
              />
              <p id={`${ids}-host-hint`} className={hintText}>
                Such as github.com. AnyKey keeps the shortcut with this site&apos;s settings.
              </p>
              {errorFor('host')}
            </div>
            <div>
              <label htmlFor={`${ids}-pages`} className={fieldLabel}>
                Pages
              </label>
              <input
                ref={pagesRef}
                id={`${ids}-pages`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={pagesValue}
                onChange={(event) => {
                  setPages(event.target.value);
                }}
                aria-invalid={errors.pages !== undefined}
                aria-describedby={describedBy('pages')}
                className={`${textInput} mt-1 font-mono`}
              />
              <p id={`${ids}-pages-hint`} className={hintText}>
                A match pattern: <code>*://github.com/*</code> is every page of the site, and{' '}
                <code>*://github.com/*/issues*</code> only its issue lists.
              </p>
              {errorFor('pages')}
            </div>
          </div>
        )}

        {keysOnly || choice === null ? (
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

        {!keysOnly && element && (
          <div className="space-y-3">
            <div>
              <label htmlFor={`${ids}-selector`} className={fieldLabel}>
                Element
              </label>
              <input
                ref={selectorRef}
                id={`${ids}-selector`}
                type="text"
                autoComplete="off"
                spellCheck={false}
                maxLength={LIMITS.selector}
                value={selector}
                onChange={(event) => {
                  setSelector(event.target.value);
                }}
                aria-invalid={errors.selector !== undefined}
                aria-describedby={describedBy('selector')}
                className={`${textInput} mt-1 font-mono`}
              />
              <p id={`${ids}-selector-hint`} className={hintText}>
                A CSS selector such as <code>#search</code> or <code>button[aria-label=&quot;Star&quot;]</code>, with{' '}
                <code>&gt;&gt;&gt;</code> to step into a shadow root. AnyKey&apos;s toolbar button can pick the element
                on the page for you instead.
              </p>
              {errorFor('selector')}
            </div>
            <div>
              <label htmlFor={`${ids}-text`} className={fieldLabel}>
                Text (optional)
              </label>
              <input
                ref={textRef}
                id={`${ids}-text`}
                type="text"
                autoComplete="off"
                maxLength={LIMITS.label}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                }}
                aria-invalid={errors.text !== undefined}
                aria-describedby={describedBy('text')}
                className={`${textInput} mt-1`}
              />
              <p id={`${ids}-text-hint`} className={hintText}>
                When the selector finds nothing, AnyKey looks for a button or link with this text.
              </p>
              {errorFor('text')}
            </div>
          </div>
        )}

        {!keysOnly && choice === NAVIGATE && (
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
              aria-describedby={describedBy('url')}
              className={`${textInput} mt-1`}
            />
            <p id={`${ids}-url-hint`} className={hintText}>
              A full address such as https://example.com, or a path on the current site such as /notifications.
            </p>
            {errorFor('url')}
          </div>
        )}

        {!keysOnly && (choice === NAVIGATE || choice === CLICK) && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newTab}
              onChange={(event) => {
                setNewTab(event.target.checked);
              }}
              className={checkbox}
            />
            {choice === CLICK ? 'Open links in a new tab' : 'Open in a new tab'}
          </label>
        )}

        {!keysOnly && (
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
              aria-describedby={describedBy('label')}
              className={`${textInput} mt-1`}
            />
            <p id={`${ids}-label-hint`} className={hintText}>
              Shown in the list of shortcuts that ? opens. Leave it empty to describe the action.
            </p>
            {errorFor('label')}
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
              maxLength={LIMITS.keys}
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
              {conflicts.map((note, i) => (
                <li key={i}>
                  <span aria-hidden="true">⚠ </span>
                  {note}
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

        {!keysOnly && (
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
