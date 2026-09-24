# Permissions

Justification for each permission AnyKey requests, written for Chrome Web Store review.

## Single purpose

AnyKey makes websites keyboard-navigable. Users bind keys to elements on any page, use link hints and scroll keys, and get shortcut presets for popular sites.

## Requested

| Permission | Why AnyKey needs it |
|---|---|
| `storage` | Saves the user's shortcuts and settings in `chrome.storage.sync`, so they follow the user across the Chrome browsers they are signed in to. Keeps a backup of those settings in `chrome.storage.local` before an import replaces them, and keeps the site presets that ship with AnyKey there, so every page reads the same checked copy. Notes in `chrome.storage.session` which tab has the element picker open, so only that tab can save shortcuts, and only while the picker is open. |
| Content script on `<all_urls>` (host access) | Keyboard shortcuts have to work on every site the user visits, so a content script runs in the top frame of every page. It listens for key presses, and it reads the page only to find the elements shortcuts act on (the user's, and a preset's, such as YouTube's like button), to describe the element the user picks for a new shortcut (its attributes and text, kept with that shortcut), and to draw link hints. It sends nothing anywhere. |

## Not requested

- `tabs`: switching to the next or previous tab, closing a tab, duplicating a tab, reloading a tab and messaging a tab's content script all work through `chrome.tabs` without it. AnyKey never reads tab URLs or titles: the popup asks the page's own content script which site it is on.
- `activeTab`, `scripting` and `host_permissions`: the content script declared in the manifest already covers every page. Tabs that were open before AnyKey was installed or updated start working once they are reloaded, and until then AnyKey's toolbar button shows a badge on them.

## Remote code and data use

- No remote code. All logic ships in the extension package. Site presets (for GitHub, YouTube and Reddit) are JSON data in the package: the background checks them against a schema before storing them, and they hold no code, only keys, page patterns and the same kinds of action the user's own shortcuts use.
- AnyKey collects no data and makes no network requests. Settings stay in the user's Chrome storage (and Chrome Sync, when the user has it turned on). Export writes them to a file only when the user asks for one.
