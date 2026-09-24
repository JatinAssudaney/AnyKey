# Backlog

Ideas left for later, with why each waits and what it would cost.

## Link hints inside frames

AnyKey's content script runs only in each page's top frame, so links and buttons inside frames (embedded players, comment widgets, some web apps' panes) get no hints, and `F` does nothing while a frame has focus.

**Why it waits.** It needs the content script in every frame (`all_frames`, which adds no permission but runs AnyKey inside every ad and widget frame too) and a protocol between frames: the top frame collects each frame's targets and places, hands out labels that are unique across frames, and routes typed keys to the frame that owns the picked label. Most sites keep their controls in the top frame, so it isn't worth that yet.

## Preset shortcuts that work from more pages

GitHub's `g r` clicks the Releases link, which only a repository's home page shows, so on the repository's other pages it finds nothing to click. A navigate action with a URL template (`/{owner}/{repo}/releases`, filled in from the current URL) would work from every page of the repository, and would suit other sites' sections too.

**Why it waits.** Templates are a new part of the action schema, with their own checks (what a template may take from the URL, and that the result stays on the site), and they need a way to write them in the options page. The one preset shortcut that needs them works from the page people start from.

## Site keys that skip some pages

A preset's list of a site's keys says where each works with match patterns, which can include pages but not leave any out. GitHub's code view keys (`t`, `w`, `y`) match every repository page, so the cheatsheet and options page also list them on issue pages, and `j` and `k`, which move through a repository's file list, are left out of the list altogether: a pattern for code pages would also cover the issue lists, where GitHub's `j` and `k` do something else and AnyKey gives way. An `excludeMatches` field on each key, as content scripts have, would place them exactly.

**Why it waits.** Only the reference lists and clash warnings are off: which keys give way is right on every page the tests cover, and a key listed on a page where it does nothing costs a line in the cheatsheet, or a warning the user can ignore. It adds a field to the preset schema, and each preset would need its pages mapped again.

## Keys for YouTube Shorts

The YouTube preset has nothing for Shorts: Shorts use the arrow keys, which AnyKey leaves alone, and `k` did nothing there when tested, so no built-in key gives way either.

**Why it waits.** Shorts change often, and their controls (like, comment, share) move between layouts, so shortcuts for them would break quickly. Worth another look once the page settles.

## Warn about physical-key shortcuts that clash with a site's keys

Conflict warnings compare a site's keys only with key-mode shortcuts. A code-mode shortcut such as `KeyS` takes GitHub's `s` on a US layout, and something else on others, with no warning.

**Why it waits.** Comparing needs the character each physical key types on the user's layout. `navigator.keyboard.getLayoutMap()` gives it in Chromium, but only in secure page contexts and not in Firefox or Safari, and code-mode shortcuts are rare.

## A switch for any built-in shortcut on one site

A site's doc can switch any built-in shortcut on or off for that site (`site:<host>.globals`), but the options page offers the switch only for the ones that give way to a preset's keys (Keep).

**Why it waits.** A switch for every built-in shortcut on every site makes the Sites section long, and turning AnyKey off for a site covers the common case. It needs a design that stays short, such as one "Built-in shortcuts on this site" list that opens on demand.

## Presets from a server

Presets could update between releases when a site changes its pages. `PresetSource` (`src/background/presets.ts`) is where a remote source plugs in; nothing else reads presets from anywhere but storage.

**Why it waits.** It needs somewhere to host the presets, a way to trust them (a signature, or fetching only from AnyKey's own server), and a decision on how often to check. Presets stay data, never code, so it would need no new permission if the server allows the request, but it would make AnyKey send requests, which it doesn't do today (PERMISSIONS.md says so).
