type Attributes = Record<string, string | number | boolean | undefined>;
type Child = Node | string | false | null | undefined;

/**
 * Creates an element for AnyKey's in-page UI. Strings become text nodes, so text taken from the page (labels,
 * link text) is never parsed as HTML. `true` sets an empty attribute; `false` and `undefined` leave it out.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child !== false && child !== null && child !== undefined) element.append(child);
  }
  return element;
}
