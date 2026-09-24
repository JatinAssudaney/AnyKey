# Permissions

Justification for each permission AnyKey requests, written for Chrome Web Store review.

## Single purpose

AnyKey makes websites keyboard-navigable. Users bind keys to elements on any page, use link hints and scroll keys, and get shortcut presets for popular sites.

## Requested

| Permission | Why AnyKey needs it |
|---|---|
| `storage` | Saves the user's shortcuts and settings in `chrome.storage.sync`, so they follow the user across the Chrome browsers they are signed in to. Keeps a backup of those settings in `chrome.storage.local` before an import replaces them, and keeps the site presets that ship with AnyKey there, so every page reads the same checked copy. Notes in `chrome.storage.session` which tab has the element picker open, so only that tab can save shortcuts, and only while the picker is open. |
| Content script on `<all_urls>` | Keyboard shortcuts have to work on every site the user visits, so a content script runs in the top frame of every page. It listens for key presses, and it reads the page only to find the elements shortcuts act on (the user's, and a preset's, such as YouTube's like button), to describe the element the user picks for a new shortcut (its attributes and text, kept with that shortcut), and to draw link hints. It sends nothing anywhere. |
| `scripting` and host permission `<all_urls>` | The browser adds the content script only to pages that load after AnyKey is installed or updated. So on install and update, AnyKey starts that same content script in the tabs already open, and their shortcuts work without a reload that would lose what the user typed. It runs nothing else, and nowhere the content script doesn't run already, so the install warning is the same. |

## Not requested

- `tabs`: switching to the next or previous tab, closing a tab, duplicating a tab, reloading a tab and messaging a tab's content script all work through `chrome.tabs` without it. AnyKey never reads tab URLs or titles, although host access would let it: the popup asks the page's own content script which site it is on, and on install and update the background asks each tab only whether AnyKey runs there.
- `activeTab`: host access to every site covers it.

## Remote code and data use

- No remote code. All logic ships in the extension package. Site presets (for GitHub, YouTube and Reddit) are JSON data in the package: the background checks them against a schema before storing them, and they hold no code, only keys, page patterns and the same kinds of action the user's own shortcuts use.
- AnyKey collects no data and makes no network requests. Settings stay in the user's Chrome storage (and Chrome Sync, when the user has it turned on). Export writes them to a file only when the user asks for one.
