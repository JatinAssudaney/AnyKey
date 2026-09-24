import type { Action, ElementTarget, ScrollDirection, TabOp } from '@/core/schema';

// The actions the options page can create, as <select> choices. Link hints come with M5.

export interface ActionChoice {
  /** The <option> value, such as "scroll:down". */
  value: string;
  name: string;
  /** Null for the choices whose action is built from more fields: a web address, or an element. */
  action: Action | null;
}

export const NAVIGATE = 'navigate';
export const CLICK = 'click';
export const FOCUS = 'focus';

const scroll = (direction: ScrollDirection, name: string): ActionChoice => ({
  value: `scroll:${direction}`,
  name,
  action: { type: 'scroll', direction },
});
const history = (op: 'back' | 'forward', name: string): ActionChoice => ({
  value: `history:${op}`,
  name,
  action: { type: 'history', op },
});
const tab = (op: TabOp, name: string): ActionChoice => ({ value: `tab:${op}`, name, action: { type: 'tab', op } });

export const ACTION_GROUPS: readonly { label: string; choices: readonly ActionChoice[] }[] = [
  {
    label: 'Scroll',
    choices: [
      scroll('down', 'Scroll down'),
      scroll('up', 'Scroll up'),
      scroll('halfDown', 'Scroll down half a page'),
      scroll('halfUp', 'Scroll up half a page'),
      scroll('top', 'Scroll to the top'),
      scroll('bottom', 'Scroll to the bottom'),
    ],
  },
  { label: 'History', choices: [history('back', 'Go back'), history('forward', 'Go forward')] },
  {
    label: 'Tabs',
    choices: [
      tab('prev', 'Previous tab'),
      tab('next', 'Next tab'),
      tab('close', 'Close tab'),
      tab('duplicate', 'Duplicate tab'),
    ],
  },
  {
    label: 'Page elements',
    choices: [
      { value: CLICK, name: 'Click an element', action: null },
      { value: FOCUS, name: 'Focus an element', action: null },
    ],
  },
  {
    label: 'Other',
    choices: [
      { value: NAVIGATE, name: 'Go to a web address', action: null },
      { value: 'cheatsheet', name: 'Show keyboard shortcuts', action: { type: 'cheatsheet' } },
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
      return `Go to ${action.url}${action.newTab === true ? ' in a new tab' : ''}`;
    case 'click':
      return `Click ${action.target.text ?? action.target.selector}`;
    case 'focus':
      return `Focus ${action.target.text ?? action.target.selector}`;
    case 'hints':
      return action.newTab === true ? 'Show link hints to open in a new tab' : 'Show link hints';
    default: {
      const value = choiceValue(action);
      return (value === null ? undefined : findChoice(value)?.name) ?? action.type;
    }
  }
}
