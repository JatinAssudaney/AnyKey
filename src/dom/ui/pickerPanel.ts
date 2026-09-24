import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { describeConflicts, findConflicts } from '../../core/conflicts';
import { keysInWords } from '../../core/keys';
import type { PickedShortcut } from '../../core/messages';
import { createRecorder, type Recorder, type RecorderStep } from '../../core/recorder';
import type { PageShortcuts } from '../../core/resolve';
import { LIMITS, storedKeys, type ElementAction, type ElementTarget, type Shortcut } from '../../core/schema';
import { truncate } from '../../core/text';
import { siteMatch } from '../../core/url';
import { keyInput } from '../engine';
import type { Disposition } from '../modes';
import { h } from './h';
import type { UiRoot } from './root';

/** How the panel closed. Either way the picker goes back to picking, so the next element can get a shortcut. */
export type PanelResult = { type: 'saved'; shortcut: PickedShortcut } | { type: 'cancelled' };

export interface PanelOptions {
  root: UiRoot;
  ctx: ContentScriptContext;
  isMac: boolean;
  host: string;
  /** What was picked, in words: `Button "Star"`. */
  description: string;
  target: ElementTarget;
  /** The action it starts with: focus for text fields, click for the rest. */
  kind: ElementAction['type'];
  /** The element is or sits in a link, which can open in a new tab. */
  isLink: boolean;
  /** What the default name calls the element: its text, or what kind of element it is. */
  name: string;
  /** The shortcuts and the site's own keys on the page now, for the conflict check. */
  page: PageShortcuts;
  /** Saves the shortcut. Resolves to an error message, or null once it is saved. */
  save(shortcut: PickedShortcut): Promise<string | null>;
  onClose(result: PanelResult): void;
}

export interface PickerPanel {
  keyDown(event: KeyboardEvent): Disposition;
  /** Reads the fields again, after text changed in them. */
  update(): void;
}

/** The id conflicts are reported under while the shortcut has none of its own. */
const NEW_ID = 'user:new';

const RECORDING_HINT = 'Press the keys, such as g then s, and Enter to save. Works on every page of this site.';
const TYPING_HINT = 'Type keys such as g s or shift+s, or record them. Works on every page of this site.';

/**
 * The form that turns a picked element into a shortcut: click or focus, a name, and keys, recorded from the moment
 * it opens or typed, with conflicts shown as the keys change. A modal dialog in AnyKey's shadow root, in the corner
 * so the page stays in view. Keys reach it through the picker's mode (rules in docs/design.md, "Picker"), never as
 * key events.
 */
export async function openPickerPanel(options: PanelOptions): Promise<PickerPanel> {
  const container = await options.root.container();
  const radio = (kind: ElementAction['type']): HTMLInputElement =>
    h('input', { type: 'radio', name: 'ak-picker-action', value: kind, checked: options.kind === kind });
  const clickRadio = radio('click');
  const focusRadio = radio('focus');
  const newTab = h('input', { type: 'checkbox' });
  const newTabRow = h('label', { class: 'ak-check' }, newTab, 'Open the link in a new tab');
  const labelInput = h('input', {
    id: 'ak-picker-label',
    type: 'text',
    class: 'ak-input',
    maxlength: LIMITS.label,
    autocomplete: 'off',
  });
  const keysInput = h('input', {
    id: 'ak-picker-keys',
    type: 'text',
    class: 'ak-input ak-mono',
    maxlength: LIMITS.keys,
    autocomplete: 'off',
    spellcheck: 'false',
    autofocus: true,
    'aria-describedby': 'ak-picker-keys-hint ak-picker-notes',
  });
  const recordButton = h('button', { type: 'button', class: 'ak-button', 'aria-pressed': 'false' }, 'Record keys');
  const recordStatus = h('span', { class: 'ak-sr-only', role: 'status' });
  const hint = h('p', { id: 'ak-picker-keys-hint', class: 'ak-hint' }, RECORDING_HINT);
  const notes = h('ul', { id: 'ak-picker-notes', class: 'ak-notes' });
  const error = h('p', { class: 'ak-error', role: 'alert' });
  const saveButton = h('button', { type: 'submit', class: 'ak-button ak-primary' }, 'Save');
  const cancelButton = h('button', { type: 'button', class: 'ak-button' }, 'Cancel');

  const form = h(
    'form',
    { class: 'ak-panel-form', novalidate: true },
    h(
      'fieldset',
      { class: 'ak-field' },
      h('legend', {}, 'When you press the keys'),
      h('label', { class: 'ak-check' }, clickRadio, 'Click it'),
      h('label', { class: 'ak-check' }, focusRadio, 'Focus it, to type in it'),
    ),
    newTabRow,
    h('div', { class: 'ak-field' }, h('label', { for: labelInput.id }, 'Name'), labelInput),
    h(
      'div',
      { class: 'ak-field' },
      h('label', { for: keysInput.id }, 'Keys'),
      h('div', { class: 'ak-row' }, keysInput, recordButton, recordStatus),
      hint,
      notes,
    ),
    error,
    h('div', { class: 'ak-actions' }, cancelButton, saveButton),
  );
  const dialog = h(
    'dialog',
    { class: 'ak-surface ak-panel', 'aria-labelledby': 'ak-picker-title' },
    h('h2', { id: 'ak-picker-title' }, `New shortcut for ${options.host}`),
    h('p', { class: 'ak-panel-target' }, options.description),
    form,
  );

  let recorder: Recorder | null = null;
  /**
   * Whether the recording is the one the panel opened with. Esc leaves the panel while that one holds no keys, and
   * starts it over once it does; Esc cancels a recording started with Record keys, as on the settings page.
   */
  let opening = false;
  let beforeRecording = '';
  let timer: number | undefined;
  /** The name the shortcut gets when the field is left as it is; it follows the action until the user edits it. */
  let defaultLabel = '';
  /** How many conflicts the keys in the field have. */
  let conflicts = 0;
  let saving = false;
  let closed = false;

  function action(): ElementAction {
    const { target } = options;
    if (focusRadio.checked) return { type: 'focus', target };
    return { type: 'click', target, ...(options.isLink && newTab.checked ? { newTab: true } : {}) };
  }

  function update(): void {
    const kind = focusRadio.checked ? 'focus' : 'click';
    newTabRow.hidden = !options.isLink || kind !== 'click';
    const label = truncate(`${kind === 'click' ? 'Click' : 'Focus'} ${options.name}`, LIMITS.label);
    if (labelInput.value === defaultLabel) labelInput.value = label;
    defaultLabel = label;
    labelInput.placeholder = label;

    keysInput.removeAttribute('aria-invalid');
    const keys = storedKeys(keysInput.value.trim(), 'key');
    const shortcut: Shortcut | null = keys.ok
      ? {
          id: NEW_ID,
          keys: keys.keys,
          keyMode: 'key',
          action: action(),
          scope: { type: 'site', match: siteMatch(options.host) },
          label: labelInput.value.trim() || label,
          source: 'user',
          enabled: true,
        }
      : null;
    const found =
      shortcut === null
        ? []
        : (findConflicts([...options.page.shortcuts, shortcut], options.isMac, options.page.native).get(NEW_ID) ?? []);
    conflicts = found.length;
    notes.replaceChildren(...describeConflicts(found).map((line) => h('li', {}, line)));
  }

  function showError(message: string): void {
    error.textContent = message;
  }

  function say(message: string): void {
    recordStatus.textContent = message;
  }

  function startRecording(fromOpening: boolean): void {
    clearTimeout(timer);
    recorder = createRecorder({ mode: 'key', isMac: options.isMac });
    opening = fromOpening;
    beforeRecording = keysInput.value;
    keysInput.value = '';
    keysInput.placeholder = 'Press keys…';
    recordButton.setAttribute('aria-pressed', 'true');
    hint.textContent = RECORDING_HINT;
    update();
  }

  function record(step: RecorderStep): void {
    clearTimeout(timer);
    const { state } = step;
    if (state.status === 'recording') {
      keysInput.value = state.keys;
      if (state.keys !== '') showError('');
      const active = recorder;
      if (step.wait !== null && active !== null) {
        timer = options.ctx.setTimeout(() => {
          record(active.timeout());
        }, step.wait);
      }
      return;
    }
    recorder = null;
    opening = false;
    recordButton.setAttribute('aria-pressed', 'false');
    keysInput.placeholder = '';
    hint.textContent = TYPING_HINT;
    if (state.status === 'cancelled' || state.keys === '') {
      keysInput.value = beforeRecording;
      say(state.status === 'cancelled' ? 'Recording cancelled.' : 'Nothing recorded.');
    } else {
      keysInput.value = state.keys;
      say(`Recorded ${inWords(state.keys)}.`);
    }
    update();
  }

  /** Esc during the recording the panel opened with: leave the panel if it holds no keys, or else start it over. */
  function escapeOpening(): void {
    if (keysInput.value === '') {
      close({ type: 'cancelled' });
      return;
    }
    keysInput.value = beforeRecording;
    startRecording(true);
    say('Cleared. Press the keys again.');
  }

  /** Enter finished a recording: save, unless the keys need a look first. */
  function enterFinished(fromOpening: boolean): void {
    const keys = keysInput.value.trim();
    if (keys === '') {
      startRecording(fromOpening);
      showError('Press the keys for this shortcut first.');
    } else if (conflicts > 0) {
      say(`Recorded ${inWords(keys)}. Check the ${conflicts === 1 ? 'warning' : 'warnings'}, then press Enter to save.`);
    } else {
      void submit();
    }
  }

  function inWords(keys: string): string {
    return keysInWords(keys, 'key', options.isMac) || keys;
  }

  function close(result: PanelResult): void {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    dialog.close();
    dialog.remove();
    options.onClose(result);
  }

  async function submit(): Promise<void> {
    if (saving || closed) return;
    const typed = keysInput.value.trim();
    const keys = typed === '' ? null : storedKeys(typed, 'key');
    if (keys?.ok !== true) {
      showError(keys === null ? 'Enter the keys for this shortcut, or record them.' : keys.error);
      keysInput.setAttribute('aria-invalid', 'true');
      keysInput.focus();
      return;
    }
    const shortcut: PickedShortcut = {
      keys: keys.keys,
      keyMode: 'key',
      action: action(),
      label: labelInput.value.trim() || defaultLabel,
    };
    saving = true;
    saveButton.disabled = true;
    showError('');
    const failure = await options.save(shortcut);
    saving = false;
    saveButton.disabled = false;
    // The panel may have closed while it waited (Esc).
    if (!dialog.isConnected) return;
    if (failure === null) close({ type: 'saved', shortcut });
    else showError(failure);
  }

  recordButton.addEventListener('click', (event) => {
    if (recorder === null) {
      startRecording(false);
      say('Recording. Press the keys, then pause. Esc cancels.');
    } else if (event.detail > 0) {
      // A mouse click stops recording. Keyboard clicks can't: Space and Enter are keys to record or finish with.
      record(recorder.timeout());
    }
  });
  // Clicking anywhere else in the panel finishes a recording, as focus leaving the button would.
  dialog.addEventListener('pointerdown', (event) => {
    if (recorder !== null && !(event.target instanceof Node && recordButton.contains(event.target))) {
      record(recorder.blur());
    }
  });
  for (const input of [clickRadio, focusRadio, newTab]) input.addEventListener('change', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });
  cancelButton.addEventListener('click', () => {
    close({ type: 'cancelled' });
  });
  // Any other way the dialog is asked to close, such as the Esc a screen reader sends.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close({ type: 'cancelled' });
  });

  // Most people want to press the keys they have in mind, so the panel opens recording them.
  startRecording(true);
  container.append(dialog);
  dialog.showModal();

  return {
    keyDown(event) {
      const bare = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
      if (recorder !== null) {
        const input = keyInput(event);
        if (input === null || event.isComposing) return 'consume';
        if (bare && event.key === 'Escape' && opening) {
          if (!event.repeat) escapeOpening();
          return 'consume';
        }
        const fromOpening = opening;
        const step = recorder.keyDown(input, event.repeat);
        record(step);
        if (bare && event.key === 'Enter' && step.state.status === 'done') enterFinished(fromOpening);
        return step.consume ? 'consume' : 'isolate';
      }
      if (bare && event.key === 'Escape') {
        if (!event.repeat) close({ type: 'cancelled' });
        return 'consume';
      }
      // A held Enter mustn't save keys whose warning the first press just brought up.
      if (event.key === 'Enter' && event.repeat) return 'consume';
      // Everything else works as in any form: typing, Tab, Enter to save, Space and arrows on the controls. The
      // fields are read again once the key's default action has run.
      options.ctx.setTimeout(() => {
        if (!closed) update();
      }, 0);
      return 'isolate';
    },
    update() {
      if (!closed) update();
    },
  };
}
