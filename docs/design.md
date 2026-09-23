# AnyKey design

The rules each area must keep. Sections marked with a milestone describe planned behavior until that milestone lands.

## Milestones

| | Scope | Status |
|---|---|---|
| M1 | Scaffold: WXT + React + TS + Tailwind, lint, tests, E2E harness, icons, docs | done |
| M2 | Key engine, global scroll/history/tab shortcuts, cheatsheet | planned |
| M3 | Storage layer, options editor with key recorder, import/export | planned |
| M4 | Element picker, per-site shortcuts from the popup | planned |
| M5 | Hint mode | planned |
| M6 | Presets, overrides, conflict warnings | planned |

## Data model

All types are `z.infer`'d from `src/core/schema.ts`.

```ts
type Shortcut = {
  id: string;              // "default:scroll-down" | "preset:github:releases" | "user:<uuid>"
  keys: string;            // "g i", "ctrl+shift+k", "mod+k", "?"
  keyMode: "key" | "code"; // event.key for characters, event.code for physical position
  action: Action;
  scope: { type: "global" } | { type: "site"; match: string };   // Chrome match pattern
  label: string;           // shown in the cheatsheet
  allowInInputs?: boolean;
  source: "default" | "preset" | "user";
  verified?: boolean;      // presets only
  enabled: boolean;
};

type Action =
  | { type: "click"; target: ElementTarget; newTab?: boolean }
  | { type: "focus"; target: ElementTarget }
  | { type: "scroll"; direction: "up" | "down" | "halfUp" | "halfDown" | "top" | "bottom" }
  | { type: "history"; op: "back" | "forward" }
  | { type: "navigate"; url: string; newTab?: boolean }   // http(s) or relative only
  | { type: "hints"; newTab?: boolean }
  | { type: "tab"; op: "next" | "prev" | "close" | "duplicate" }
  | { type: "cheatsheet" };

type ElementTarget = {
  selector: string;        // " >>> " steps into a shadow root
  fallbacks?: string[];
  text?: string;           // visible text or aria-label, last-resort match
  tag?: string;            // restricts the text match, e.g. "button"
};

type PresetOverride = { keys?: string; keyMode?: "key" | "code"; enabled?: boolean };  // keyed by preset shortcut id
type ReservedKey = { keys: string; label: string; yield?: boolean; match?: string };
type Preset = {
  schemaVersion: 1; id: string; name: string; version: number;
  matches: string[];          // preset shortcuts take their scope from these
  reserved: ReservedKey[];    // the site's native shortcuts
  shortcuts: PresetShortcut[];
};
type Settings = {
  sequenceTimeoutMs: number;  // 800
  scrollStep: number;         // 60 (px)
  smoothScroll: boolean;      // true
  hintChars: string;          // "sadfjklewcmpgh"
  newTabInBackground: boolean;// true
};
```

Default global shortcuts: `j`/`k` scroll, `d`/`u` half page, `g g` top, `G` bottom, `f`/`F` hints, `H`/`L` history back/forward, `J`/`K` previous/next tab, `x` close tab, `?` cheatsheet. All remappable and disableable.

## Storage (M3)

`chrome.storage.sync` (102,400 bytes total; 8,192 per item counted as UTF-8 bytes of key + JSON value; 120 writes/min, 1,800/hour; one multi-key `set()` is one write):

| Key | Contents |
|---|---|
| `settings` | `Settings` |
| `global` | `{ shortcuts: user global shortcuts, overrides: Record<defaultId, { keys?, keyMode?, enabled? }> }` |
| `site:<host>` | `{ disabled?, shortcuts: user site shortcuts, globals?: Record<defaultId, { enabled }> }` |
| `preset:<presetId>` | `{ overrides: Record<presetShortcutId, PresetOverride> }` |

Every doc carries a version field `v` and stays under 8KB (about 20 to 25 picker shortcuts per site). A doc is never split across items: Chrome sync delivers items independently, so a split doc could be read half-updated. Any stored-format change bumps `v`.

`chrome.storage.local`: `presets` (validated bundled presets, written by the background on install and update) and the pre-import backup.

**Single writer.** The popup, options page and content script read storage (all sync docs, then `storage.onChanged`) and send typed mutation messages to the background. The background re-reads the affected docs, applies the pure reducers in `src/storage/mutations.ts`, validates and size-checks the result, coalesces writes into one `set()` (about 300ms window, at most one write per 500ms, backing off on quota errors) and acks so the UI can show Saved or the error. Options text fields commit on blur or Enter.

**Bad or newer docs.** A doc that fails validation or carries a newer `v` stays readable (its valid shortcuts still work) and is never written back; the options page offers a reset for it.

**Import/export.** Export is a versioned dump of all sync docs. Import replaces everything after a preview, and saves the previous data to `storage.local` so it can be restored.

## Resolution

Pure `resolve()` in `src/core/resolve.ts` computes the shortcuts for one URL and returns active, shadowed and yielded shortcuts plus the site's native reserved keys:

1. If `site:<exact host>.disabled`, nothing is active.
2. Defaults, with `global.overrides` applied.
3. For each preset whose `matches` include the URL: a reserved key with `yield: true` (and a matching `match`, if set) turns off defaults still on their default keys; user-rekeyed defaults and user shortcuts are never yielded. `site:<host>.globals` can re-enable or disable a default on that host. Preset shortcuts are added with `preset:<id>` overrides applied.
4. User global shortcuts, then user site shortcuts whose `match` includes the URL (from every site doc, so a scope edited to another host still works).
5. Precedence: user site > user global > preset > default. For identical key sequences the higher one wins and the rest are shadowed. A higher-precedence single key also shadows lower-precedence sequences that start with it. Two winners at the same rank produce a duplicate warning.

The content script caches the result by `location.href`; when the URL changes it re-resolves and clears the key buffer.

## Key engine (M2)

- Listen on `window`, capture phase, registered at `document_start` so it runs before page listeners.
- Consume a key (`preventDefault` + `stopImmediatePropagation`) only when it matches. Swallow the matching `keyup`, tracked by `event.code`; clear the tracking on window blur.
- Pure prefixes pass through to the page (GitHub's native `g i` keeps working). A key that is both a full shortcut and a prefix is consumed and fires on timeout (`sequenceTimeoutMs`) or when the next key breaks the sequence; the breaking key is then re-fed alone.
- Repeats never advance a sequence. Only single-chord scroll shortcuts fire on repeat, scrolling instantly.
- Ignore: IME composition (`isComposing || keyCode === 229`), modifier-only keys, and editable focus unless `allowInInputs`. Editable means `composedPath()[0]` or the deep active element is a text-type input, textarea, select, contenteditable, `role=textbox|searchbox|combobox`, or the document is in `designMode`.
- Canonical keys: Caps Lock without Shift lowercases letters; key mode drops Shift for printable characters (`G`, `?`) but keeps an explicit `shift+` alongside Ctrl/Alt/Meta (`ctrl+shift+k`); macOS Option combos take the letter from `event.code`; `mod` is Meta on macOS and Ctrl elsewhere. When a key-mode and a code-mode shortcut match the same press, key mode wins.
- Each handler first checks `ctx.isInvalid`: after an extension update the old content script keeps running with dead APIs and must let every key through.
- A mode stack routes keys: normal shortcuts, hint mode, picker mode, and focus inside AnyKey's UI.
- Element targets resolve at press time: selector, then fallbacks, then text or aria-label among interactive elements (restricted by `tag` when set), preferring visible matches and piercing open and closed shadow roots. When nothing matches, show a toast.

## In-page UI (M2)

- One lazily mounted `createShadowRootUi` host: closed mode, `isolateEvents`, inline at `<html>`. CSS goes in through the `css` option, so no stylesheet is web-accessible. The CSS avoids `@property` and `@font-face` (WXT would hoist them into the page).
- Overlays live in the top layer (popover or `<dialog>`) so they show above page modals and fullscreen video.
- Key and focus events from inside the host are handed to AnyKey's UI by the window capture listener, then stopped with `stopImmediatePropagation()` and no `preventDefault`: text still types, while page hotkeys and focus traps never see the events.

## Picker (M4)

- Capture-phase listeners block the page's pointer, mouse and click handlers while picking. Hover promotes to the nearest interactive ancestor; Up/Down walk to parent/child; Esc cancels.
- Selector priority: `data-testid` / `data-test` / `data-qa`; a non-generated id; aria-label; role plus accessible name (`a[href]`, `name`, `title`, `placeholder`); stable classes; a short structural path. Scoring heuristics live in `src/core/selectorScore.ts` (generated ids such as digit runs, hashes and `:r1:`; hashed CSS-module, styled-components and utility classes; aria-labels with digits become `^=` prefixes). Candidates are built and checked for uniqueness in the live DOM; the next 1 to 3 unique ones become `fallbacks`, and the text/aria-label and tag are stored too.

## Hints (M5)

- Candidates: links, buttons, `role=button|link|...`, inputs, `[onclick]`, `tabindex >= 0`, and `cursor: pointer` elements whose parent is not also pointer (checked only for elements in the viewport). Filtered by `checkVisibility()` and an `elementFromPoint` occlusion check that follows the shadow-host chain.
- Prefix-free labels from `hintChars`. Typing narrows by label letters; Backspace and Esc work. `F` opens links in a new tab through the background (background tab when `newTabInBackground`); non-links get a mod-click.

## Presets (M6)

- Bundled JSON in `presets/`, validated with zod when loaded. Loading goes through a `PresetSource` interface so a remote data source can be added later without code changes elsewhere.
- Each preset lists the site's native shortcuts as `reserved` keys; preset shortcuts only add actions the site lacks, and every one ships with `verified: false` until checked with `docs/preset-checklist.md`.
- `?` stays AnyKey's cheatsheet on every site. The cheatsheet shows a "Native to this site" section built from the preset's reserved keys.

## Security

- Navigate and new-tab URLs must be http(s) or relative, so imported JSON cannot carry `javascript:` URLs.
- The background validates every message with zod. Labels and selectors have length caps.
