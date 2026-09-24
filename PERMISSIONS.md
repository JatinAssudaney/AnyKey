# Permissions

Justification for each permission AnyKey requests, written for Chrome Web Store review. Draft: finalized in milestone M6.

## Single purpose

AnyKey makes websites keyboard-navigable. Users bind keys to elements on any page, use link hints and scroll keys, and get shortcut presets for popular sites.

## Requested

| Permission | Why AnyKey needs it |
|---|---|
| `storage` | Saves the user's shortcuts and settings in `chrome.storage.sync`, so they follow the user across the Chrome browsers they are signed in to. Keeps a backup of those settings in `chrome.storage.local` before an import replaces them, and caches the bundled site presets there. |
| Content script on `<all_urls>` (host access) | Keyboard shortcuts have to work on every site the user visits, so a content script runs in the top frame of every page. It listens for key presses, and it reads the page only to find the elements the user bound keys to and to draw link hints. It sends nothing anywhere. |

## Not requested

- `tabs`: switching to the next or previous tab, closing a tab and duplicating a tab all work through `chrome.tabs` without it. AnyKey never reads tab URLs or titles.
- `activeTab`, `scripting` and `host_permissions`: the content script declared in the manifest already covers every page. Tabs that were open before AnyKey was installed or updated start working once they are reloaded.

## Remote code and data use

- No remote code. All logic ships in the extension package, and site presets are bundled JSON data.
- AnyKey collects no data and makes no network requests. Settings stay in the user's Chrome storage (and Chrome Sync, when the user has it turned on). Export writes them to a file only when the user asks for one.
