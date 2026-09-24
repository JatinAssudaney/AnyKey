# AnyKey design

The rules each area must keep. Sections marked with a milestone describe planned behavior until that milestone lands.

## Milestones

| | Scope | Status |
|---|---|---|
| M1 | Scaffold: WXT + React + TS + Tailwind, lint, tests, E2E harness, icons, docs | done |
| M2 | Key engine, global scroll/history/tab shortcuts, cheatsheet | done |
| M3 | Storage layer, options editor with key recorder, import/export | done |
| M4 | Element picker, per-site shortcuts from the popup | done |
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

Default global shortcuts (`src/core/defaults.ts`): `j`/`k` scroll, `d`/`u` half page, `g g` top, `G` bottom, `f`/`F` hints (added with hint mode in M5), `H`/`L` history back/forward, `J`/`K` previous/next tab, `x` close tab, `?` cheatsheet. All remappable and disableable.

## Storage

`chrome.storage.sync` (102,400 bytes total; 8,192 per item, counted as the UTF-8 bytes of the key plus the value as Chrome's JSON writer writes it, which escapes `<` as `\u003C`; 512 items; 120 writes a minute and 1,800 an hour, where one multi-key `set()` is one write):

| Key | Contents |
|---|---|
| `settings` | The settings that differ from their defaults |
| `global` | `{ shortcuts: user global shortcuts, overrides: Record<defaultId, { keys?, keyMode?, enabled? }> }` |
| `site:<host>` | `{ disabled?, shortcuts: user site shortcuts, globals?: Record<defaultId, { enabled }> }` |
| `preset:<presetId>` | `{ overrides: Record<presetShortcutId, PresetOverride> }` (M6) |

- Every doc carries a version field `v` and stays under 8KB (about 20 to 25 picker shortcuts per site). A doc is never split across items: Chrome sync delivers items independently, so a split doc could be read half-updated. Any stored-format change bumps `v` (`DOC_VERSION` in `src/core/docs.ts`).
- Storage stays sparse: a setting equal to its default and an override equal to the built-in shortcut are left out, and a doc left empty is removed (a site doc once the site is on, with no shortcuts and no `globals`), so a later version can improve the defaults. Keys are stored in canonical notation (`ctrl+k`, never `Ctrl+K`).
- A site shortcut lives in the doc of the site it was made for, named in the `saveShortcut` mutation (`site`), which a site shortcut must have and a global one must not. Its `match` may be edited to other pages, even of another host. Saving a shortcut takes it out of any other doc, so changing where it works moves it, and both docs are written in the same save.
- `chrome.storage.local` holds `backup` (below) and, from M6, `presets` (validated bundled presets, written by the background on install and update). `chrome.storage.session` holds picker sessions (see Picker); content scripts can't read or write that area.

**Reading.** The content script and the options page read every sync item and read again after each change; an older read never overwrites a newer one. `parseSync` never throws: an entry that fails its schema is skipped, and its doc is reported as damaged, or as newer when its `v` is above this version's. No shortcut runs in a page until storage has loaded.

**Single writer.** Only the background writes (`src/storage/writer.ts`). Pages send typed mutations (`src/core/messages.ts`), and the background accepts them only from AnyKey's own pages (the sender URL is under the extension's origin): a page could otherwise drive its content script to rewrite settings. The one thing a content script may save is a shortcut from the picker, under the rules in Picker. The writer:

1. collects mutations for 300ms, and starts a save at least 1000ms after the last one (a save writes at most a `set` and a `remove`, so at most 120 writes a minute);
2. reads all of sync storage fresh and applies the pure reducers in `src/storage/mutations.ts` in order; a mutation that fails is rejected on its own and the rest still save;
3. checks the result before writing: it fits the quotas, and the reader takes every doc it writes back whole (a doc the reader flags would be locked as damaged). Keys are checked in their stored, canonical form (`storedKeys` in `src/core/schema.ts`), which can be longer than what was typed (`cmd` is stored as `meta`). It then writes only the docs whose JSON changed;
4. answers each sender once its change is saved, or with the reason it failed. A quota error from the browser fails the batch with a message and is never retried.

**Docs with problems.** A damaged or newer doc stays readable (its valid shortcuts keep working) and is never written back by an ordinary change, which fails with a message instead. Three things may replace it: an import, a restore, and Repair on the options page, which rewrites the doc with only what this version can read.

**Import and export.** Export writes every sync item, unknown keys included, as `{ format: "anykey-settings", version: 1, exportedAt, items }`. Import checks the file (at most 1 MB, the right format, not a newer `version`), previews what it holds, and then replaces every doc this version knows: `settings`, `global` and each `site:<host>`. Unknown keys, such as a newer version's docs, stay as they are, and entries this version can't read are left out. First the sync items as they stood become the `backup` in `chrome.storage.local` (`{ savedAt, items }`); if the sync write then fails, the previous backup goes back, since nothing was replaced. Restoring the backup swaps the two, putting the backup's docs back exactly as they were (even what this version can't read), so a second restore undoes the first.

## Resolution

Pure `resolve()` in `src/core/resolve.ts` computes the shortcuts for one URL and returns active, shadowed and yielded shortcuts plus the site's native reserved keys:

1. If `site:<exact host>.disabled`, nothing is active.
2. Defaults, with `global.overrides` applied.
3. For each preset whose `matches` include the URL: a reserved key with `yield: true` (and a matching `match`, if set) turns off defaults still on their default keys; user-rekeyed defaults and user shortcuts are never yielded. `site:<host>.globals` can re-enable or disable a default on that host. Preset shortcuts are added with `preset:<id>` overrides applied.
4. User global shortcuts, then user site shortcuts whose `match` includes the URL (from every site doc, so a scope edited to another host still works).
5. Precedence: user site > user global > preset > default. For identical key sequences the higher one wins and the rest are shadowed; within a rank the first wins, and M3's conflict checks warn about the duplicate. A higher-precedence sequence also shadows lower-precedence sequences that start with it (a user's `g` shadows a preset's `g e`); same-rank prefixes stay active and wait for the timeout. Sequences are compared as match tokens, after `mod` resolves for the platform.

Steps 1, 2, 4 and 5 are built (`shortcutsForUrl` feeds `resolve`); step 3 arrives with presets (M6). The content script resolves again whenever storage changes, and at the next keydown after the URL changes (single-page apps navigate without a reload). A change to only the `#` part doesn't count: match patterns ignore it, and some sites rewrite it as you scroll. When the resolved shortcuts differ, the key buffer starts empty; otherwise a sequence in progress goes on.

## Key engine

`src/dom/engine.ts` feeds keydowns to the pure matcher in `src/core/sequence.ts`.

- Listen on `window`, capture phase, registered at `document_start` so it runs before page listeners.
- Each handler first checks `ctx.isInvalid`: after an extension update or reload the old content script keeps running with dead APIs and must let every key through. Untrusted (script-dispatched) events are ignored, so a page can't fire shortcuts such as `x`.
- Consume a key (`preventDefault` + `stopImmediatePropagation`) only when it completes a shortcut, or continues a sequence whose earlier keys were consumed.
- A keyup goes where its key's first keydown went, tracked by `event.code`: swallowed if consumed, kept from the page if a UI mode or AnyKey's UI took it, and delivered otherwise, even after focus has moved into AnyKey's UI (Shift pressed on the way to `?` must come back up for the page, or the page thinks it is still held). A keyup with no tracked keydown is kept from the page only when it comes from AnyKey's UI. Clear the tracking on window blur.
- Pure prefixes pass through to the page (GitHub's native `g i` keeps working). A key that is both a full shortcut and a prefix is consumed and fires on timeout (`sequenceTimeoutMs`) or when the next key breaks the sequence; the keys after that full match are then replayed as a fresh start. A key that breaks a pure prefix is replayed alone (`g` then `j` scrolls).
- Repeats never advance a sequence. A repeat of a key the page received stays with the page; a repeat of a consumed key is swallowed, and fires again only for single-chord scroll shortcuts, which then scroll instantly.
- Ignore: IME composition (`isComposing || keyCode === 229`), modifier and lock keys (Shift on the way to `G` must not break a sequence), and editable focus unless `allowInInputs`. Editable means `composedPath()[0]` or the deep active element (through closed shadow roots, via `chrome.dom`) is a text-type input, textarea, select, contenteditable, `role=textbox|searchbox|combobox`, or the document is in `designMode`.
- Canonical keys (`parseKeys` for notation, `keyToken` for events; both must agree):
  - Without Ctrl/Alt/Meta, letter case follows Shift, so Caps Lock never changes a shortcut. `G` and `shift+g` are the same chord.
  - With Ctrl/Alt/Meta, letter case is ignored and Shift is explicit: `ctrl+K` means `ctrl+k`.
  - Shift is dropped for other characters (`?`); notation such as `shift+/` is an error. `+` is written `plus`.
  - macOS Option chords read the US-layout character of `event.code` (`alt+k`, not `˚`). The Ctrl+Alt that AltGr reports while typing a character is dropped.
  - `mod` is Meta on macOS and Ctrl elsewhere. When a key-mode and a code-mode shortcut match the same press, key mode wins.
- A mode stack routes keys: normal shortcuts, then UI modes (the cheatsheet and the picker; hint mode in M5). While a UI mode is on top, every keydown goes to it and never reaches the page. Modes treat auto-repeats as the same press: holding `?` a little long must not close the cheatsheet it just opened (hint mode needs the same for `f`).
- A mode leaves the stack the moment it closes, never in a `<dialog>`'s `close` event: Chrome fires that event as a queued task, and input outranks queued tasks, so a key pressed right after Esc would still go to the closed mode.

## Scrolling

Scroll keys move the nearest scrollable ancestor of the element last clicked or focused, skipping ancestors with no room left in that direction (like native scroll chaining); then the page; then, for apps whose page never scrolls, the scrollable ancestor of the viewport's center or else the largest visible scroller. Smooth scrolling is off for key repeats and under `prefers-reduced-motion`.

## In-page UI

- One lazily mounted `createShadowRootUi` host (`<anykey-ui>`): closed mode, without WXT's `isolateEvents` (the key engine isolates UI events itself, and that option's bubble-phase stop would also hide the keyups the page is owed), appended to `<html>` so pages that replace `<body>` don't remove it, and remounted if a page does. CSS goes in through the `css` option, so no stylesheet is web-accessible. The CSS avoids `@property` and `@font-face` (WXT would hoist them into the page).
- Overlays live in the top layer (modal `<dialog>`, `popover`) so they show above page modals and fullscreen video.
- Keydown, keypress and focus events from inside the host are handed to AnyKey's UI by the window capture listener, then stopped with `stopImmediatePropagation()` and no `preventDefault`: text still types, while page hotkeys and focus traps never see the events. Input events from inside the host (`beforeinput`, `input`, composition, `paste`, `copy`, `cut`) are stopped the same way and reported to the top mode's `uiInput`.
- So elements inside the host never receive keydown, keypress, focus or input events. In-page UI reacts to keys through its mode's `keyDown` (returning `isolate` lets the key type or move focus) and to typed text through `uiInput`. Click, change, submit, pointer and a dialog's `cancel` events do arrive.
- Trusted pointer and mouse events (`pointerdown`, `pointerup`, `pointermove`, `pointercancel`, `mousedown`, `mouseup`, `mousemove`, `click`, `dblclick`, `auxclick`, `contextmenu`) go to the top mode's `pointer` handler first, at window capture.
- The content script sets `noScriptStartedPostMessage`, so WXT never posts messages to the page.

## Options page

- Built-in shortcuts can be rekeyed, switched off and reset; the user's own global shortcuts can be added, edited, switched off and deleted. A change shows at once and saves in the background: the header's status says "Saving…" then "Saved.", and a failure appears in an alert. Text fields save on blur or Enter.
- Sites lists every site with a doc: a switch for AnyKey on the site, and its shortcuts to switch off, edit and delete. "Add a site shortcut" and each site's "Add shortcut for <host>" take any action; click and focus take a typed selector (" >>> " steps into shadow roots) and optional text. The site field accepts a pasted address and keeps its host; the pages follow the site (`*://<host>/*`) until edited. A site changed on the page stays listed while it holds nothing, so no control vanishes while in use.
- Conflict warnings come from `src/core/conflicts.ts`: a shortcut that doesn't run because another takes its keys (and the one that takes them), a key that waits for the sequence timeout because a longer shortcut that still runs starts with it, keys the browser keeps for itself on this platform, and a shortcut that also runs in text fields on a key that types.
- The key recorder (`src/core/recorder.ts`, shared with the picker's panel) never traps focus. Esc cancels, and its keydown is cancelled so the dialog around it stays open. Tab finishes and moves focus on as usual. Enter, a 1-second pause, or a fourth chord finishes. Auto-repeats and lone modifiers don't count as keys. The platform's command key is recorded as `mod`, so a shortcut recorded on a Mac works on Windows. Key mode records characters (`?`), code mode records physical keys (`shift+Slash`).
- When a change removes the focused control, focus moves to the nearest control that stays, never back to the top of the page: Reset to the row's Edit button, Delete to Add shortcut (a site shortcut's Delete to its site's Add button), Repair to the next Repair button or else Export.

## Popup

- The popup can't read the tab's URL without the `tabs` permission, so it asks the tab's content script (`pageInfo`). No answer means AnyKey isn't running there: a browser page, or a tab opened before AnyKey was installed or updated, which "Reload this tab" fixes.
- For a web page it shows the site, a switch for AnyKey on the site (by exact host), the site shortcuts that apply to the page, and "Add shortcut for this site", which starts the picker and closes the popup so the page is in view.

## Picker

**Sessions.** The picker starts only from the popup. The popup sends `startPicker` with the tab and its site; the background records a session in `chrome.storage.session` (`picker:<tabId>`: `{ startedAt, host }`) and asks the tab's top frame to pick (`src/background/picker.ts`). If no content script answers, the session ends and the popup says to reload the tab. The content script then saves with `addSiteShortcut`, which carries only keys, key mode, action and name. The background accepts it only from a tab's top frame, on an http(s) page, while that tab has a session for the sender's host that is under 30 minutes old. The site comes from the sender's URL, which the browser vouches for, never from the message, and the shortcut covers every page of it (`*://<host>/*`). The session lasts until the picker closes (`pickerDone`), so one session can save a shortcut for each element the user picks. A hostile page can therefore add shortcuts only for its own site, only while the user has the picker open on it, and no more than its site's 8 KB doc holds.

**Picking** (`src/dom/picker.ts`).
- The page gets no presses or clicks: `pointerdown`, `pointerup`, `mousedown`, `mouseup`, `click`, `dblclick`, `auxclick` and `contextmenu` are stopped at window capture. Hovering still reaches the page, so a menu that opens on hover can be picked from.
- Keys with Ctrl, Alt or Meta go to the browser (not the page); every other key is the picker's.
- The element under the pointer (through open and closed shadow roots) moves up to the nearest interactive element it sits in, at most 6 levels. ↑ and ↓ walk to the parent and back down. Tab and Shift+Tab move through visible interactive elements in document order, shadow roots included, starting with what is on screen. It starts on the element that had focus when the popup opened. Enter or a click picks.
- The picker stays open after each shortcut is saved or cancelled, so several elements can get shortcuts in one go. The banner confirms each save, and its button changes from Cancel to Done. Esc or that button closes the picker, and a toast sums up what was saved.
- The outline and the banner of instructions are popovers that let the pointer through. The banner moves to the top while the element sits under it.

**The panel** (`src/dom/ui/pickerPanel.ts`) is a modal `<dialog>` in the corner, so the page stays in view. It offers click or focus (focus for text fields), "Open the link in a new tab" for links, a name that says what the shortcut does until the user edits it, keys, and warnings for conflicts with the shortcuts on the page. Save, Cancel and Esc all go back to picking.
- It opens recording keys, with the shared recorder, since most people want to press the keys they have in mind. Esc before any key leaves the panel; Esc after one starts the recording over.
- Enter that ends a recording saves, unless the keys clash with another shortcut: then the warning shows and the next Enter saves. Held Enter repeats never save.
- A pause, Tab, or a click elsewhere in the panel ends the recording without saving. After that the field takes typed notation, and Record keys records again, working as on the settings page (Esc cancels it and puts back what the field had).

**Selectors** (`src/dom/selectorCandidates.ts`, heuristics in `src/core/selectorScore.ts`). Candidates, most stable first:
1. test attributes: `data-testid`, `data-test-id`, `data-test`, `data-qa`, `data-cy`;
2. an id that isn't generated (not `:r1:`, long numbers, hashes, or numbered library ids such as `mat-input-0`);
3. `aria-label`, `title` or `placeholder`, as a `^=` prefix of the words before the first number when the label has one (counts change);
4. `name`; a link's `href`; `input[type]` for distinctive types such as `search`; `role`;
5. stable classes, alone and then in pairs (not state, utility, CSS-module, styled-components or other build-made names);
6. any of those below the nearest ancestor with a unique test attribute or id;
7. a structural path of `:nth-of-type` steps up to such an ancestor.

Each candidate must match only the element within its own document or shadow root, and " >>> " joins the chain of shadow hosts. The first is the selector and up to 3 more are fallbacks. The element's text (up to 100 characters) and tag are stored too.

**Finding the element** (`src/dom/targets.ts`) happens at press time: the selector, then the fallbacks, then the text among interactive elements (or elements of `tag`), searched through open and closed shadow roots. The text match ignores case, spacing and numbers ("Like 1,203" finds "Like 1,204"), and text with no words in it never matches. A visible match wins over a hidden one found earlier, and a hidden one is used only when nothing visible matches. AnyKey's own UI is never searched. When nothing matches, a toast names the shortcut.

**Running** (`src/dom/click.ts`). Click sends pointer and mouse events to the element's center, then a click, so menus that open on `pointerdown` or `mousedown` open too. A click with `newTab` on a link opens the link through the background, as navigate does. Focus focuses the element, or the first focusable element inside it, with the caret at the end; when nothing takes focus, a toast says so.

## Hints (M5)

- Candidates: links, buttons, `role=button|link|...`, inputs, `[onclick]`, `tabindex >= 0`, and `cursor: pointer` elements whose parent is not also pointer (checked only for elements in the viewport). Filtered by `checkVisibility()` and an `elementFromPoint` occlusion check that follows the shadow-host chain.
- Prefix-free labels from `hintChars`. Typing narrows by label letters; Backspace and Esc work. `F` opens links in a new tab through the background (background tab when `newTabInBackground`); non-links get a mod-click.

## Presets (M6)

- Bundled JSON in `presets/`, validated with zod when loaded. Loading goes through a `PresetSource` interface so a remote data source can be added later without code changes elsewhere.
- Each preset lists the site's native shortcuts as `reserved` keys; preset shortcuts only add actions the site lacks, and every one ships with `verified: false` until checked with `docs/preset-checklist.md`.
- `?` stays AnyKey's cheatsheet on every site. The cheatsheet shows a "Native to this site" section built from the preset's reserved keys.

## Security

- Navigate and new-tab URLs must be http(s) or relative, so imported JSON cannot carry `javascript:` URLs.
- The background validates every message with zod and accepts messages only from AnyKey's own contexts. Setting changes and picker starts come only from its own pages; a content script can add a site shortcut only during a picker session (see Picker). Labels and selectors have length caps.
- The content script validates stored data before using it. Schemas use `zod/mini`, whose functions tree-shake, so the content script carries only the schemas it parses with (about 26 kB, where classic zod would add about 85 kB), and none of the reducers, import or export code.
