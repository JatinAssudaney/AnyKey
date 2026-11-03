import type { Action, ElementTarget, ScrollDirection, TabOp } from '@/core/schema';
import { t, type MessageKey } from '@/i18n';

// The actions the options page can create, as <select> choices.

export interface ActionChoice {
  /** The <option> value, such as "scroll:down". */
  value: string;
  name: MessageKey;
  /** Null for the choices whose action is built from more fields: a web address, or an element. */
  action: Action | null;
}

export const NAVIGATE = 'navigate';
export const CLICK = 'click';
export const FOCUS = 'focus';

const scroll = (direction: ScrollDirection, name: MessageKey): ActionChoice => ({
  value: `scroll:${direction}`,
  name,
  action: { type: 'scroll', direction },
});
const history = (op: 'back' | 'forward', name: MessageKey): ActionChoice => ({
  value: `history:${op}`,
  name,
  action: { type: 'history', op },
});
const tab = (op: TabOp, name: MessageKey): ActionChoice => ({ value: `tab:${op}`, name, action: { type: 'tab', op } });

export const ACTION_GROUPS: readonly { label: MessageKey; choices: readonly ActionChoice[] }[] = [
  {
    label: 'action.groups.scroll',
    choices: [
      scroll('down', 'action.scrollDown'),
      scroll('up', 'action.scrollUp'),
      scroll('halfDown', 'action.scrollHalfDown'),
      scroll('halfUp', 'action.scrollHalfUp'),
      scroll('top', 'action.scrollTop'),
      scroll('bottom', 'action.scrollBottom'),
    ],
  },
  { label: 'action.groups.history', choices: [history('back', 'action.back'), history('forward', 'action.forward')] },
  {
    label: 'action.groups.tabs',
    choices: [
      tab('prev', 'action.prevTab'),
      tab('next', 'action.nextTab'),
      tab('close', 'action.closeTab'),
      tab('duplicate', 'action.duplicateTab'),
    ],
  },
  {
    label: 'action.groups.elements',
    choices: [
      { value: 'hints', name: 'action.hints', action: { type: 'hints' } },
      { value: 'hints:newTab', name: 'action.hintsNewTab', action: { type: 'hints', newTab: true } },
      { value: CLICK, name: 'action.click', action: null },
      { value: FOCUS, name: 'action.focus', action: null },
    ],
  },
  {
    label: 'action.groups.other',
    choices: [
      { value: NAVIGATE, name: 'action.navigate', action: null },
      { value: 'cheatsheet', name: 'action.cheatsheet', action: { type: 'cheatsheet' } },
    ],
  },
];

const CHOICES = new Map(ACTION_GROUPS.flatMap((group) => group.choices.map((choice) => [choice.value, choice])));

export function findChoice(value: string): ActionChoice | undefined {
  return CHOICES.get(value);
}

/** The choice value for an action, or null when the options page can't edit that kind of action. */
export function choiceValue(action: Action): string | null {
  const value =
    action.type === 'scroll'
      ? `scroll:${action.direction}`
      : action.type === 'history' || action.type === 'tab'
        ? `${action.type}:${action.op}`
        : action.type === 'hints' && action.newTab === true
          ? 'hints:newTab'
          : action.type;
  return CHOICES.has(value) ? value : null;
}

/** The fields some choices take their action from. */
export interface ActionFields {
  url: string;
  /** A web address or a link opens in a new tab. */
  newTab: boolean;
  target: ElementTarget;
}

/** The action a choice makes, with the web address or the element from the form where it needs one. */
export function actionOf(value: string, fields: ActionFields): Action {
  const fixed = findChoice(value)?.action ?? null;
  if (fixed !== null) return fixed;
  const newTab = fields.newTab ? { newTab: true } : {};
  if (value === CLICK) return { type: 'click', target: fields.target, ...newTab };
  if (value === FOCUS) return { type: 'focus', target: fields.target };
  return { type: 'navigate', url: fields.url.trim(), ...newTab };
}

/** What an action does, in words. */
export function describeAction(action: Action): string {
  switch (action.type) {
    case 'navigate':
      return t(action.newTab === true ? 'action.goToNewTab' : 'action.goTo', { url: action.url });
    case 'click':
      return t('action.clickTarget', { target: action.target.text ?? action.target.selector });
    case 'focus':
      return t('action.focusTarget', { target: action.target.text ?? action.target.selector });
    default: {
      const value = choiceValue(action);
      const name = value === null ? undefined : findChoice(value)?.name;
      return name === undefined ? action.type : t(name);
    }
  }
}
