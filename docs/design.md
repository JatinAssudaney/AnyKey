# AnyKey design

The rules each area must keep. Sections marked with a milestone describe planned behavior until that milestone lands.

## Milestones

| | Scope | Status |
|---|---|---|
| M1 | Scaffold: WXT + React + TS + Tailwind, lint, tests, E2E harness, icons, docs | done |
| M2 | Key engine, global scroll/history/tab shortcuts, cheatsheet | done |
| M3 | Storage layer, options editor with key recorder, import/export | done |
| M4 | Element picker, per-site shortcuts from the popup | done |
| M5 | Hint mode | done |
| M6 | Presets, overrides, conflict warnings | done |

## Data model

All types are `z.infer`'d from `src/core/schema.ts`, and the preset types from `src/core/presets.ts`.

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

type Preset = {
  schemaVersion: 1;
  id: string;                 // "github": lowercase letters, digits and dashes
  name: string;               // "GitHub", shown in the UI
  version: number;            // the highest version of an id wins
  matches: string[];          // the site's pages, as match patterns
  reserved: ReservedKey[];    // the site's own shortcuts, up to 300
  shortcuts: PresetShortcut[];// up to 50
};
type ReservedKey = {
  keys: string;               // key-mode notation, canonical
  label: string;              // what the site does
  yield?: boolean;            // AnyKey's built-in shortcut on these keys gives way (see Presets)
  matches?: string[];         // only on these pages
};
type PresetShortcut = {       // becomes a Shortcut: scope from the preset, source "preset"
  id: string;                 // "preset:<presetId>:<name>"
  keys: string; keyMode: "key" | "code"; action: Action; label: string; allowInInputs?: boolean;
  verified: boolean;          // checked on the live site with docs/preset-checklist.md
  matches?: string[];         // only on these pages
};
type PresetOverride = {       // the user's change to a preset shortcut, keyed by its id
  keys?: string; keyMode?: "key" | "code";  // together or not at all
  enabled?: boolean;
};
type Settings = {
  sequenceTimeoutMs: number;  // 800
  scrollStep: number;         // 60 (px)
  smoothScroll: boolean;      // true
  hintChars: string;          // "sadfjklewcmpgh"
  newTabInBackground: boolean;// true
};
```

Default global shortcuts (`src/core/defaults.ts`): `j`/`k` scroll, `d`/`u` half page, `g g` top, `G` bottom, `F` link hints, `g f` link hints that open in a new tab, `H`/`L` history back/forward, `J`/`K` previous/next tab, `x` close tab, `?` cheatsheet. All remappable and disableable.

## Storage

`chrome.storage.sync` (102,400 bytes total; 8,192 per item, counted as the UTF-8 bytes of the key plus the value as Chrome's JSON writer writes it, which escapes `<` as `\u003C`; 512 items; 120 writes a minute and 1,800 an hour, where one multi-key `set()` is one write):

| Key | Contents |
|---|---|
| `settings` | The settings that differ from their defaults |
| `global` | `{ shortcuts: user global shortcuts, overrides: Record<defaultId, { keys?, keyMode?, enabled? }> }` |
| `site:<host>` | `{ disabled?, shortcuts: user site shortcuts, globals?: Record<defaultId, { enabled }> }`, where `globals` are the host's own switches for built-in shortcuts |
| `preset:<presetId>` | `{ overrides: Record<presetShortcutId, PresetOverride> }`, the user's changes to a preset's shortcuts |

- Every doc carries a version field `v` and stays under 8KB (about 20 to 25 picker shortcuts per site). A doc is never split across items: Chrome sync delivers items independently, so a split doc could be read half-updated. Any stored-format change bumps `v` (`DOC_VERSION` in `src/core/docs.ts`).
- Storage stays sparse: a setting equal to its default and an override equal to the built-in shortcut are left out, and a doc left empty is removed (a site doc once the site is on, with no shortcuts and no `globals`), so a later version can improve the defaults. Keys are stored in canonical notation (`ctrl+k`, never `Ctrl+K`).
- A site shortcut lives in the doc of the site it was made for, named in the `saveShortcut` mutation (`site`), which a site shortcut must have and a global one must not. Its `match` may be edited to other pages, even of another host. Saving a shortcut takes it out of any other doc, so changing where it works moves it, and both docs are written in the same save.
- `chrome.storage.local` holds `backup` (below) and `presets`, which only the background writes (see Presets). `chrome.storage.session` holds picker sessions (see Picker); content scripts can't read or write that area.

**Reading.** The content script and the options page read every sync item and read again after each change; an older read never overwrites a newer one. `parseSync` never throws: an entry that fails its schema is skipped, and its doc is reported as damaged, or as newer when its `v` is above this version's. No shortcut runs in a page until storage has loaded.

**Single writer.** Only the background writes (`src/storage/writer.ts`). Pages send typed mutations (`src/core/messages.ts`), and the background accepts them only from AnyKey's own pages (the sender URL is under the extension's origin): a page could otherwise drive its content script to rewrite settings. The one thing a content script may save is a shortcut from the picker, under the rules in Picker. The writer:

1. collects mutations for 300ms, and starts a save at least 1000ms after the last one (a save writes at most a `set` and a `remove`, so at most 120 writes a minute);
2. reads all of sync storage fresh and applies the pure reducers in `src/storage/mutations.ts` in order; a mutation that fails is rejected on its own and the rest still save;
3. checks the result before writing: it fits the quotas, and the reader takes every doc it writes back whole (a doc the reader flags would be locked as damaged). Keys are checked in their stored, canonical form (`storedKeys` in `src/core/schema.ts`), which can be longer than what was typed (`cmd` is stored as `meta`). It then writes only the docs whose JSON changed;
4. answers each sender once its change is saved, or with the reason it failed. A quota error from the browser fails the batch with a message and is never retried.

**Docs with problems.** A damaged or newer doc stays readable (its valid shortcuts keep working) and is never written back by an ordinary change, which fails with a message instead. Three things may replace it: an import, a restore, and Repair on the options page, which rewrites the doc with only what this version can read.

**Import and export.** Export writes every sync item, unknown keys included, as `{ format: "anykey-settings", version: 1, exportedAt, items }`. Import checks the file (at most 1 MB, the right format, not a newer `version`), previews what it holds, and then replaces every doc this version knows: `settings`, `global`, each `site:<host>` and each `preset:<presetId>`. Unknown keys, such as a newer version's docs, stay as they are, and entries this version can't read are left out. First the sync items as they stood become the `backup` in `chrome.storage.local` (`{ savedAt, items }`); if the sync write then fails, the previous backup goes back, since nothing was replaced. Restoring the backup swaps the two, putting the backup's docs back exactly as they were (even what this version can't read), so a second restore undoes the first.

## Resolution

`pageShortcuts()` in `src/core/resolve.ts` gathers the shortcuts that apply to one URL (steps 1 to 4), and pure `resolve()` picks those that run (step 5):

1. If `site:<exact host>.disabled`, nothing applies.
2. Defaults, with `global.overrides` applied, then the host's own switches (`site:<host>.globals`).
3. For each preset whose `matches` include the URL: defaults give way to the site's keys (see Presets), and the preset's shortcuts for the page are added with the user's changes from `preset:<presetId>`. `pageShortcuts` also returns the site's keys that work on the page and the defaults that gave way, for the cheatsheet, the popup and the picker's warnings.
4. User global shortcuts, then user site shortcuts whose `match` includes the URL (from every site doc, so a scope edited to another host still works).
5. Precedence: user site > user global > preset > default. For identical key sequences the higher one wins and the rest are shadowed; within a rank the first wins, and M3's conflict checks warn about the duplicate. A higher-precedence sequence also shadows lower-precedence sequences that start with it (a user's `g` shadows a preset's `g e`); same-rank prefixes stay active and wait for the timeout. Sequences are compared as match tokens, after `mod` resolves for the platform.

The content script resolves only once sync storage and the presets have both loaded, again whenever either changes, and at the next keydown after the URL changes (single-page apps navigate without a reload). A change to only the `#` part doesn't count: match patterns ignore it, and some sites rewrite it as you scroll. When the resolved shortcuts differ, the key buffer starts empty; otherwise a sequence in progress goes on.

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
- Keys show as keycaps (`keycapLabels`, and `keysInWords` for sentences): modifiers first, as macOS symbols in Apple's order (⌃ ⌥ ⇧ ⌘) or as names elsewhere. A capital letter shows the Shift it takes (`F` shows as ⇧F, or Shift+F), because keyboards print their letters as capitals and a bare F reads as the f key.
- A mode stack routes keys: normal shortcuts, then UI modes (the cheatsheet, the picker and link hints). While a UI mode is on top, every keydown goes to it and never reaches the page. Modes treat auto-repeats as the same press: holding `?` a little long must not close the cheatsheet it just opened, and holding `F` must not type the hint labeled F.
- A mode leaves the stack the moment it closes, never in a `<dialog>`'s `close` event: Chrome fires that event as a queued task, and input outranks queued tasks, so a key pressed right after Esc would still go to the closed mode.

## Scrolling

Scroll keys move the nearest scrollable ancestor of the element last clicked or focused, skipping ancestors with no room left in that direction (like native scroll chaining); then the page; then, for apps whose page never scrolls, the scrollable ancestor of the viewport's center or else the largest visible scroller. Smooth scrolling is off for key repeats and under `prefers-reduced-motion`.

## In-page UI

- One lazily mounted `createShadowRootUi` host (`<anykey-ui>`): closed mode, without WXT's `isolateEvents` (the key engine isolates UI events itself, and that option's bubble-phase stop would also hide the keyups the page is owed), appended to `<html>` so pages that replace `<body>` don't remove it, and remounted if a page does. CSS goes in through the `css` option, so no stylesheet is web-accessible. The CSS avoids `@property` and `@font-face` (WXT would hoist them into the page). AnyKey's icon (`src/dom/ui/icon.ts`) is built element by element too: an image file would have to be web-accessible, and parsing markup trips pages that enforce Trusted Types. A test keeps it the same as `src/assets/icon.svg`.
- Overlays live in the top layer (modal `<dialog>`, `popover`) so they show above page modals and fullscreen video.
- Keydown, keypress and focus events from inside the host are handed to AnyKey's UI by the window capture listener, then stopped with `stopImmediatePropagation()` and no `preventDefault`: text still types, while page hotkeys and focus traps never see the events. Input events from inside the host (`beforeinput`, `input`, composition, `paste`, `copy`, `cut`) are stopped the same way and reported to the top mode's `uiInput`.
- So elements inside the host never receive keydown, keypress, focus or input events. In-page UI reacts to keys through its mode's `keyDown` (returning `isolate` lets the key type or move focus) and to typed text through `uiInput`. Click, change, submit, pointer and a dialog's `cancel` events do arrive.
- Trusted pointer and mouse events (`pointerdown`, `pointerup`, `pointermove`, `pointercancel`, `mousedown`, `mouseup`, `mousemove`, `click`, `dblclick`, `auxclick`, `contextmenu`) go to the top mode's `pointer` handler first, at window capture.
- The content script sets `noScriptStartedPostMessage`, so WXT never posts messages to the page.

## Options page

- Built-in shortcuts can be rekeyed, switched off and reset; the user's own global shortcuts can be added, edited, switched off and deleted. A change shows at once and saves in the background: the header's status says "Saving…" then "Saved.", and a failure appears in an alert. Text fields save on blur or Enter.
- Sites lists every site with a doc, and each site a preset names (`presetHosts`: the patterns for one host), by host without a leading "www.". The list stays short however many sites people add (sorting, search and counts are in `src/entrypoints/options/sites.ts`):
  - each site is one row: a button that opens it, summing up its presets, its shortcuts and how many of them have a warning, and the switch for AnyKey on the site;
  - one site is open at a time, below its row, with its shortcuts to switch off, edit and delete. Opening a site closes the open one, and the clicked row keeps its place on screen, even when the site that closed sat above it;
  - "Find a site" narrows the list by host or preset name (a pasted address finds its site), and Enter opens the first site found;
  - a save that puts a shortcut on a site opens that site, from either section, so the options page (`App`) holds which site is open.
- "Add a site shortcut" (above the list) and each site's "Add shortcut for <host>" take any action; click and focus take a typed selector (" >>> " steps into shadow roots) and optional text. The site field accepts a pasted address and keeps its host; the pages follow the site (`*://<host>/*`) until edited. A site changed on the page stays listed while it holds nothing, so no control vanishes while in use.
- A site with a preset gets a panel for it (`PresetPanel`):
  - the preset's shortcuts, marked Unverified until checked, to switch off, rekey (keys and key mode only) and reset one by one. Only what differs from the preset is stored (`presetOverride`);
  - "Built-in shortcuts that give way to <Site>", each with a Keep switch that sets the host's own switch (`setSiteDefault`); switching it off removes the switch, so the default gives way again;
  - "<Site>'s own keys", a reference of the site's keys with the pages they work on and the shortcut that takes each, if any. This list and the one above run long (GitHub has dozens of keys), so both start closed, with their length on the summary;
  - "Reset to the <Site> preset" (`resetToPreset`), shown once there is something to reset. It asks first, clears `preset:<presetId>` and the host's `globals`, and can also delete the host's own shortcuts.
- Conflict warnings come from `src/core/conflicts.ts`: a shortcut that doesn't run because another takes its keys (and the one that takes them), a key that waits for the sequence timeout because a longer shortcut that still runs starts with it, keys the browser keeps for itself on this platform, a shortcut that also runs in text fields on a key that types, and clashes with a site's own keys (see Presets). On a site, warnings cover the whole site at once (`shortcutsOnSite`): every preset shortcut and site key, whatever pages they are for.
- The key recorder (`src/core/recorder.ts`, shared with the picker's panel) never traps focus. Esc cancels, and its keydown is cancelled so the dialog around it stays open. Tab finishes and moves focus on as usual. Enter, a 1-second pause, or a fourth chord finishes. Auto-repeats and lone modifiers don't count as keys. The platform's command key is recorded as `mod`, so a shortcut recorded on a Mac works on Windows. Key mode records characters (`?`), code mode records physical keys (`shift+Slash`).
- Settings save on blur or Enter once they pass the settings schema; a failure shows as an alert under the field. Hint characters are saved in small letters, since hints ignore case.
- When a change removes the focused control, focus moves to the nearest control that stays, never back to the top of the page: Reset to the row's Edit button, Delete to Add shortcut (a site shortcut's Delete to its site's Add button), Repair to the next Repair button or else Export.
- Focus follows a saved shortcut to its Edit button whenever it may not sit beside the button that opened the dialog: after an edit (which can move it to another site, or between a site and every site), and after adding one to another list than the Add button's own. "Add a site shortcut" sits above every site, so its new shortcuts always take focus with them.

## Popup

- The popup can't read the tab's URL without the `tabs` permission, so it asks the tab's content script (`pageInfo`). No answer means AnyKey isn't running there: a browser page, or a tab opened before AnyKey was installed or updated, which "Reload this tab" fixes.
- For a web page it shows the site, a switch for AnyKey on the site (by exact host), the site shortcuts that apply to the page, and "Add shortcut for this site", which starts the picker and closes the popup so the page is in view.
- It teaches the keys that work on the page, as `resolve()` finds them there, so a rekeyed or disabled default shows as it is: the cheatsheet key, and hint mode with the key that shows hints (what labels are for, and that keys pick labels until one is picked or Esc). A line goes when its action has no key.
- On a site with a preset, a section lists the preset's shortcuts for the page (noting any that are off, or replaced by the user's on the same keys) and names the built-in keys that go to the site's own shortcuts on the page.
- Alt+Shift+K (⌥⇧K on macOS) opens it: the manifest's `_execute_action` command, which works in every tab, even where the content script can't run. A command isn't a permission and brings no install warning. The browser holds the key: it gives the suggested key only when nothing else has it, and people change it at `chrome://extensions/shortcuts`. So the popup and the options page's Shortcuts section read the key from `commands.getAll()` (the options page again when it gets focus back, after a change there), show it as keycaps split from the browser's own text (`commandKeycaps`), and offer to set one when there is none.

## Picker

**Sessions.** The picker starts only from the popup. The popup sends `startPicker` with the tab and its site; the background records a session in `chrome.storage.session` (`picker:<tabId>`: `{ startedAt, host }`) and asks the tab's top frame to pick (`src/background/picker.ts`). If no content script answers, the session ends and the popup says to reload the tab. The content script then saves with `addSiteShortcut`, which carries only keys, key mode, action and name. The background accepts it only from a tab's top frame, on an http(s) page, while that tab has a session for the sender's host that is under 30 minutes old. The site comes from the sender's URL, which the browser vouches for, never from the message, and the shortcut covers every page of it (`*://<host>/*`). The session lasts until the picker closes (`pickerDone`), so one session can save a shortcut for each element the user picks. A hostile page can therefore add shortcuts only for its own site, only while the user has the picker open on it, and no more than its site's 8 KB doc holds.

**Picking** (`src/dom/picker.ts`).
- The page gets no presses or clicks: `pointerdown`, `pointerup`, `mousedown`, `mouseup`, `click`, `dblclick`, `auxclick` and `contextmenu` are stopped at window capture. Hovering still reaches the page, so a menu that opens on hover can be picked from.
- Keys with Ctrl, Alt or Meta go to the browser (not the page); every other key is the picker's.
- The element under the pointer (through open and closed shadow roots) moves up to the nearest interactive element it sits in, at most 6 levels. ↑ and ↓ walk to the parent and back down. Tab and Shift+Tab move through visible interactive elements in document order, shadow roots included, starting with what is on screen. It starts on the element that had focus when the popup opened. Enter or a click picks.
- The picker stays open after each shortcut is saved, so several elements can get shortcuts in one go. The banner confirms each save, and its button changes from Cancel to Done. Esc or that button closes the picker, as does the panel's Cancel, and a toast sums up what was saved.
- The outline and the banner of instructions are popovers that let the pointer through. The banner moves to the top while the element sits under it.

**The panel** (`src/dom/ui/pickerPanel.ts`) is a modal `<dialog>` in the corner, so the page stays in view. It offers click or focus (focus for text fields), "Open the link in a new tab" for links, a name that says what the shortcut does until the user edits it, keys, and warnings for conflicts with the shortcuts on the page. Save and Esc go back to picking, so the next element, or a better pick, is one step away. Cancel closes the picker: someone who cancels is done.
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

## Hints

`F` puts a label on everything in view that can be clicked or typed into, and typing a label picks that element; `g f` does the same to open links in a new tab (`src/dom/hints.ts`, labels from `src/core/hintLabels.ts`). Hints cover the top frame only, where the content script runs.

The keys aren't Vimium's `f` and `F`: `f` is fullscreen on YouTube and most other video players, while few sites bind `F`. `g f` is what Surfingkeys uses to open a link in a new tab, and it adds no wait, since `g` already waits for a second key for `g g`. GitHub's Actions pages use `g f` to open the workflow file, so AnyKey's `g f` gives way to GitHub's there (see Presets). Their full-screen logs answer to `f` as well as `F`, so hints keep `F`.

**Targets**, in document order through open and closed shadow roots:
- the interactive elements the picker moves between (links, buttons, form fields, ARIA widget roles, contenteditable, `[onclick]`, `tabindex` 0 and up) that aren't `:disabled`;
- elements that only a pointer cursor marks as clickable, as on sites that handle clicks in script: the outermost element with `cursor: pointer`, unless it sits inside a control. Styles are read only for elements in view, since reading them is slow.

A target must be in the viewport, rendered (`checkVisibility` with `visibility` checked but not opacity: a transparent file input laid over a button is what takes the click), and uncovered: the element hit at the middle of its box in view, or at one of four points around the middle, is the target or inside it. Content made inert by a modal dialog fails that check. An element with no box of its own (a link around a floated image) is placed by its first child's box in view.

Hints that would repeat others go. A target inside another target with the same box (each side within 4 px) takes that one's hint: a link that fills a menu item. An element that only its pointer cursor or tabindex marks as clickable gets no hint when a target sits inside it: a wrapper around a button, a scrolling region of links.

**Labels** come from `hintChars`, which the settings schema keeps to 2 or more characters, none repeated (capital and small letters count as the same) and no spaces. No label is the start of another, so a label is picked the moment it is complete. Labels are as short as they can be: all have the same length or one more, as few as possible are longer, and the longer ones start with the least comfortable characters, so the first targets in the page get the most comfortable single keys. Labels show in capitals and typing ignores case, so Shift and Caps Lock don't matter.

**Keys** while hints show (none reach the page):
- A hint character narrows the hints to the labels that go on with it, and picks the target once only one is left. A character that no label goes on with does nothing.
- Backspace takes back the last character. Esc closes the hints.
- Keys with Ctrl, Alt or Meta go to the browser, as in the picker. Every other key does nothing, and auto-repeats are ignored.

A press anywhere (`pointerdown` or `mousedown`), the window losing focus, or the extension going away also closes the hints; the press still reaches the page.

**Drawing.** One popover layer over the viewport, in the top layer, lets the pointer through (`pointer-events: none`) and is `aria-hidden`. Each label sits on its target's top left corner (moved in from the viewport's top and left edges) and follows the target when the page or any scroller scrolls and when the window resizes. A label whose target left the view or the page hides.

While hints show, a bar at the bottom center names the mode and how to leave it ("Hint mode: type a label to click it, or press Esc to go back to your shortcuts", or "open it in a new tab" for `g f`). Keys pick labels instead of running shortcuts until the hints close, and without the bar that looks like shortcuts breaking. The bar goes with the hints, so its going says the shortcuts are back. Labels draw above it, and one on its text makes it hard to read, so it sits at the bottom center, or at the top while fewer labels would sit on it there.

**Picking** (`activate` in `src/dom/executor.ts`). A text field (whatever `isEditable` covers) takes focus with the caret at the end, and a `<select>` also opens its list. Anything else gets the same click as a click shortcut. For `g f`, a link opens in a new tab through the background (behind the current tab when `newTabInBackground` is on), and anything else gets a Ctrl or Cmd click. A target that left the page since the hints appeared gets a toast, and so does a page with nothing to hint.

Targets are collected when the key is pressed, before the layer mounts, so keys typed right after `F` are never lost. The scan reads every element's box: about 20 ms for 13,000 elements on a fast machine, growing linearly.

## Presets

**Data.** Presets are JSON files in `presets/`, checked with `PresetSchema` (see Data model): keys in canonical notation, and shortcut ids that start with `preset:<presetId>:`. A reserved key or preset shortcut with `matches` works only on those pages: GitHub's `t` opens the file finder on repository pages (`*://github.com/*/*`). In a match pattern `*` also matches `/`, and the path includes the query string, so `*://github.com/*/*/issues?*` covers `/owner/repo/issues?q=is:open`. Each preset lists the site's own shortcuts from its help pages and its code, except those that work only while typing (markdown formatting, find and replace in editors): AnyKey doesn't act in text fields, so they never clash.

**Installing.** The background reads presets from `PresetSource`s (`src/background/presets.ts`; today only the bundled files), checks each on its own (one that fails is logged and left out), keeps the highest `version` of each id, and writes them to `chrome.storage.local` as `presets` on install, update and browser start, only when they changed, since every open tab resolves again when they do. The content script, popup and options page read and watch that key, and check it again (`parsePresets`). A remote source can plug in later: presets are data, and their actions pass the same schemas as the user's shortcuts, so a preset can't carry code or a `javascript:` URL.

**The user's changes** to a preset's shortcuts live in `preset:<presetId>`, apart from the preset, so a new version of the preset keeps them; a change to a shortcut the new version dropped does nothing. Keys are stored with their key mode, so the writer and the reader can check them without the preset.

**Giving way.** A reserved key with `yield: true` turns off the built-in shortcut on the same keys, on the pages where the reserved key works, unless:
- the user rekeyed the built-in shortcut (its keys or key mode differ from the built-in ones), since user settings beat presets;
- the host has its own switch for it (`site:<host>.globals`, the options page's Keep switch), which beats the preset whichever way it is set.

User shortcuts never give way. Only keys that equal a built-in shortcut's are marked `yield` (a test checks each preset). A site sequence that starts with a built-in key needs nothing: a pure prefix passes through, so GitHub's `g c` works although AnyKey has `g g`.

| Site and pages | Keys that give way | The site's own shortcut |
|---|---|---|
| GitHub, repository pages | `g g` | Go to the Discussions tab |
| GitHub, issue and pull request lists | `u` | Filter by author |
| GitHub, issue and pull request pages | `x` | Link an issue or pull request (AnyKey's `x` would close the tab there) |
| GitHub, Actions pages | `g f` | Go to the workflow file |
| GitHub, the network graph | `j` `k` `H` `L` `J` `K` | Scroll the graph |
| YouTube, video pages (`/watch*`) | `j` `k` | Go back 10 seconds, play or pause |
| Reddit, every page | `j` `k` `x` | Next and previous post or comment, expand a post in compact view |
| Reddit, the mod queue (`/mod/*`) | `d` | Remove |

These stay AnyKey's although the site uses them: `?` on all three sites (AnyKey's cheatsheet lists the site's keys too); `F` on GitHub's Actions run pages, whose full-screen logs also answer to `f`; `J` in GitHub's code view, where it only highlights the line at the cursor; and `d` on YouTube, which uses it only in 360° videos. YouTube reads most letters with or without Shift, so AnyKey's `F`, `J`, `K` and `L` also take keys from it; its reserved list names only the keys YouTube documents. On YouTube Shorts `k` does nothing and AnyKey doesn't use the arrow keys, so nothing gives way there.

**Clashes with the site's keys** (`findConflicts` with the site's keys):
- A key-mode shortcut whose keys equal a site key, or the start of one, takes it, so the site's shortcut doesn't run (`takesNative`).
- A shortcut that starts with a whole site key runs after it (`afterNative`): the site acts on the first keys, which can stop the rest from reaching AnyKey (`s x` on GitHub: `s` moves focus to the search bar, and `x` types there). This applies only when no shortcut takes that site key.
- Only key-mode shortcuts are compared: site keys are characters, and the character a physical key types depends on the layout.
- The picker compares with the site's keys on the page (`pageShortcuts`), the options page with all of them (`shortcutsOnSite`), where a built-in shortcut that gives way to a key doesn't count as taking it (`yieldedBy`). The site keys a shortcut clashes with in the same way share one warning.

**The cheatsheet** starts with "<Site>'s own keys": the site's keys that work on the page and that no active shortcut takes (`nativeKeysLeft`). They come first because on a site with a preset they are what its pages are built around. AnyKey's groups follow, starting with Page elements, which holds the preset's shortcuts and the ones picked on the site. Keys with the same label share a row ("k or Space"), and past 24 rows the dialog widens to fit more columns.

**Checking.** Every preset shortcut ships with `verified: false`, which the options page shows as Unverified, until it is checked on the live site with `docs/preset-checklist.md`; it then becomes `verified: true` in the preset's next version. Preset shortcuts use keys that none of the site's own shortcuts use on any of its pages, which a test checks.

## Security

- Navigate and new-tab URLs must be http(s) or relative, so imported JSON cannot carry `javascript:` URLs.
- The background validates every message with zod and accepts messages only from AnyKey's own contexts. Setting changes and picker starts come only from its own pages; a content script can add a site shortcut only during a picker session (see Picker). Labels and selectors have length caps.
- Presets are data, checked when installed and again when read, and their actions pass the same schemas as the user's shortcuts.
- The content script validates stored data before using it. Schemas use `zod/mini`, whose functions tree-shake, so the content script carries only the schemas it parses with (about 26 kB, where classic zod would add about 85 kB), and none of the reducers, import or export code.
