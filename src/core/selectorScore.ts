// Heuristics for the element picker (rules in docs/design.md, "Picker"): which ids, classes and labels stay the same
// when a site re-renders or ships a new build, and how to write them into selectors. The DOM side that builds and
// checks the candidates lives in src/dom/selectorCandidates.ts.

/** `value` as a CSS identifier, escaped the way `CSS.escape` does it (CSSOM, "serialize an identifier"). */
export function cssIdent(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const char = value.charAt(i);
    if (code === 0) out += '\uFFFD';
    else if (
      isControl(code) ||
      (i === 0 && isDigit(code)) ||
      (i === 1 && isDigit(code) && value.charCodeAt(0) === 0x2d)
    ) {
      out += codePointEscape(code);
    } else if (i === 0 && char === '-' && value.length === 1) out += '\\-';
    else if (code >= 0x80 || char === '-' || char === '_' || isDigit(code) || /[a-z]/i.test(char)) out += char;
    else out += `\\${char}`;
  }
  return out;
}

/**
 * `value` as a quoted CSS string (CSSOM, "serialize a string"). `>` is escaped too, so a string never holds the
 * " >>> " that steps into a shadow root.
 */
export function cssString(value: string): string {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const char = value.charAt(i);
    if (code === 0) out += '\uFFFD';
    else if (isControl(code) || char === '>') out += codePointEscape(code);
    else if (char === '"' || char === '\\') out += `\\${char}`;
    else out += char;
  }
  return `${out}"`;
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isControl(code: number): boolean {
  return (code >= 0x1 && code <= 0x1f) || code === 0x7f;
}

function codePointEscape(code: number): string {
  return `\\${code.toString(16)} `;
}

/** Libraries that number the ids they make: headlessui-menu-button-3, mat-input-0, ember412. */
const NUMBERED_ID =
  /^(?:ember|ext-gen|gwt-uid|yui_|mui-|headlessui-|react-select-|react-aria|downshift-|rc-|radix-|select2-|ui-id-|cdk-|mat-|tippy-|floating-ui-|chakra-|mantine-|base-ui-|pr_id_)/i;

/**
 * Whether an id looks made up by code rather than written by a person, so it may change on the next render or
 * build: React's `:r1:`, `«r1»` and `_r_1_`, long numbers, UUIDs and hashes, and numbered library ids.
 */
export function isGeneratedId(id: string): boolean {
  if (/[:«»]/.test(id) || /^_.*_$/.test(id) || /^\d+$/.test(id) || /\d{4,}/.test(id)) return true;
  if (id.split(/[-_.]/).some(isHashLike)) return true;
  return /\d/.test(id) && NUMBERED_ID.test(id);
}

/** A token such as "1a2b3c" or "3xYz1": letters mixed with at least two digits, as hashes and counters make them. */
function isHashLike(segment: string): boolean {
  if (segment.length < 5 || !/^[a-z\d]+$/i.test(segment)) return false;
  const digits = segment.replace(/\D/g, '').length;
  return digits >= 2 && digits < segment.length;
}

/** Classes that say what state an element is in, which changes as people use the page. */
const STATE_CLASSES = new Set([
  'active',
  'current',
  'selected',
  'checked',
  'disabled',
  'enabled',
  'open',
  'opened',
  'closed',
  'expanded',
  'collapsed',
  'show',
  'shown',
  'showing',
  'hide',
  'hidden',
  'visible',
  'invisible',
  'in',
  'out',
  'fade',
  'focus',
  'focused',
  'focus-visible',
  'hover',
  'hovered',
  'pressed',
  'highlighted',
  'loading',
  'loaded',
  'error',
  'invalid',
  'valid',
  'dirty',
  'pristine',
  'touched',
  'untouched',
  'animating',
  'animated',
  'dragging',
]);

/** Single-purpose utility classes (Tailwind, Bootstrap) that many elements share and redesigns shuffle. */
const UTILITY_CLASSES = new Set([
  'flex',
  'grid',
  'block',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'contents',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'static',
  'truncate',
  'underline',
  'italic',
  'uppercase',
  'lowercase',
  'capitalize',
  'container',
  'sr-only',
  'not-sr-only',
  'grow',
  'shrink',
  'border',
  'rounded',
  'shadow',
  'outline',
  'ring',
  'transition',
  'transform',
  'antialiased',
  'clearfix',
  'row',
  'col',
]);

/** A utility name and a value: "mt-4", "text-center", "bg-red-500", "d-flex", "w-full". */
const UTILITY =
  /^-?(?:[mp][trblxyse]?|gap|gap-[xy]|space-[xy]|inset|inset-[xy]|top|right|bottom|left|start|end|z|w|h|min-w|max-w|min-h|max-h|size|basis|order|grow|shrink|col-span|row-span|col-start|col-end|grid-cols|grid-rows|col|row|g|gx|gy|opacity|duration|delay|ease|leading|tracking|line-clamp|rounded|rounded-[trblse]{1,2}|border|border-[trblxyse]|shadow|ring|outline|text|bg|font|fs|fw|lh|d|flex|items|justify|content|self|place-items|place-content|overflow|overflow-[xy]|cursor|select|object|align|whitespace|break|translate-[xy]|rotate|scale|scale-[xy])-(?:[\d.]+|px|auto|full|screen|min|max|fit|none|hidden|visible|scroll|clip|start|end|center|between|around|evenly|stretch|baseline|wrap|nowrap|col|row|xs|sm|base|md|lg|xl|\dxl|thin|light|normal|medium|semibold|bold|extrabold|black|white|tight|snug|relaxed|loose|wide|wider|widest|left|right|justify|inherit|current|transparent|pointer|block|inline|inline-block|inline-flex|flex|grid|table|[a-z]+-\d{2,3})$/;

/** Bootstrap's breakpoint utilities: "col-md-6", "d-lg-none", "mt-sm-3". */
const RESPONSIVE_UTILITY = /^[a-z]+(?:-[a-z]+)?-(?:sm|md|lg|xl|xxl)-[\w-]+$/;

/**
 * Whether a class names what an element is, so it survives a redesign or a new build. Class names that describe
 * state, single-purpose utilities, and names a build tool made up (CSS modules, styled-components, emotion) don't.
 */
export function isStableClass(name: string): boolean {
  // Tailwind variants and values ("md:flex", "w-1/2", "!mt-0"), and anything else unusual.
  if (!/^-?[a-z_][\w-]*$/i.test(name) || name.length > 40) return false;
  const lower = name.toLowerCase();
  if (STATE_CLASSES.has(lower) || /^(?:is|has)-/.test(lower)) return false;
  if (UTILITY_CLASSES.has(lower) || UTILITY.test(lower) || RESPONSIVE_UTILITY.test(lower)) return false;
  if (/^(?:sc-|css-|jss|emotion-|svelte-|astro-|ng-|makestyles-|_ngcontent)/.test(lower)) return false;
  // CSS modules: component_local__hash.
  if (/^[a-z][\w-]*_[\w-]+__[\w-]{5}$/i.test(name)) return false;
  if (/\d{3,}/.test(name) || name.split(/[-_]/).some(isHashLike)) return false;
  // styled-components hashes such as "kKDfcA": short, letters only, capitals in the middle.
  if (/^[a-z]{5,8}$/i.test(name) && (name.slice(1).match(/[A-Z]/g) ?? []).length >= 2 && /[a-z]/.test(name)) return false;
  return true;
}

/**
 * An attribute condition that finds an element by a label it shows or announces, such as aria-label. A label with
 * a number in it changes as counts change (YouTube's like button says "like this video along with 1,234 other
 * people"), so only the words before the first number are matched. Null when too few of them are left.
 */
export function labelCondition(attribute: string, label: string): string | null {
  const digit = label.search(/\d/);
  if (digit === -1) return `[${attribute}=${cssString(label)}]`;
  const prefix = label.slice(0, digit).trimEnd();
  return prefix.replace(/\W/g, '').length >= 3 ? `[${attribute}^=${cssString(prefix)}]` : null;
}
