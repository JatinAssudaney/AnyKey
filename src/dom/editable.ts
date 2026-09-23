import { deepActiveElement } from './shadow';

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

const TEXT_ROLES = new Set(['textbox', 'searchbox', 'combobox']);

/** Whether keys typed while this element has focus belong to it rather than to shortcuts. */
export function isEditable(element: Element): boolean {
  if (element instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(element.type);
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  const role = element.getAttribute('role')?.trim().split(/\s+/)[0];
  return role !== undefined && TEXT_ROLES.has(role);
}

/**
 * The user is typing: the event's innermost target or the focused element (inside shadow roots too) is editable,
 * or the whole document is in design mode. Checking both covers closed shadow roots, which hide the real target.
 */
export function isTypingContext(event: Event): boolean {
  if (document.designMode === 'on') return true;
  const target = event.composedPath()[0];
  if (target instanceof Element && isEditable(target)) return true;
  const active = deepActiveElement();
  return active !== null && isEditable(active);
}
