# Backlog

Ideas left for later, with why each waits and what it would cost.

## Start AnyKey in tabs that were already open

Browsers add content scripts only to pages that load after AnyKey is installed, updated or reloaded. A tab that was already open has no AnyKey (after an install) or a dead copy that steps aside (after an update or reload). Its shortcuts do nothing until the tab is reloaded, and a site's own `?` opens instead of the cheatsheet (YouTube, for one). Chrome and Brave update extensions in the background, so users hit this after every release, and new users find AnyKey doing nothing in the tabs they already had open.

**Why it waits.** Fixing it takes more permissions, and AnyKey keeps its permission list short so people aren't put off installing (decided 2026-09-24). Until then, the popup tells the user to reload the tab, with a button that does it.

**Options**, fewest permissions first:

- **Welcome page on install** that says open tabs need a reload. No new permissions. Helps with the first install only.
- **Toolbar badge on tabs without a live AnyKey.** After an install or update, the background marks every open tab, and each content script clears its own tab's mark when it starts. No new permissions. Shows the problem without fixing it.
- **Start AnyKey from the toolbar icon.** Opening the popup in such a tab injects AnyKey there. Needs `activeTab` and `scripting`, neither of which adds an install warning. Fixes one tab at a time, when the user clicks.
- **Start AnyKey in every open tab** on install and update. Needs `scripting` and host access to all sites. The install warning stays the same, since the content script already runs on all sites, but it adds two permissions to justify in Web Store review, and the background could read every tab's URL.

No option reaches pages where extensions can't run: browser pages such as `brave://extensions`, the new tab page, the Web Store and other extensions' pages.
