import type { Action, ScrollDirection, TabOp } from '@/core/schema';

// The actions the options page can create, as <select> choices. Clicking and focusing elements come with the
// picker (M4), and link hints with M5.

export interface ActionChoice {
  /** The <option> value, such as "scroll:down". */
  value: string;
  name: string;
  /** Null for "Go to a web address", whose action is built from the form. */
  action: Action | null;
}

export const NAVIGATE = 'navigate';

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

/** The action a choice makes. "Go to a web address" takes the URL and new-tab fields. */
export function actionOf(value: string, navigate: { url: string; newTab: boolean }): Action {
  return (
    findChoice(value)?.action ?? {
      type: 'navigate',
      url: navigate.url.trim(),
      ...(navigate.newTab ? { newTab: true } : {}),
    }
  );
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
