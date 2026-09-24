# AnyKey: Keyboard Shortcuts for Any Website

A Chrome extension that makes any website keyboard-navigable: bind a key to any element, use Vimium-style link hints and scroll keys everywhere, and get shortcut presets for popular sites. Your settings always override presets.

## Using it

- **Scroll and move around** on any page: `j`/`k` scroll, `d`/`u` half a page, `g g` and `G` the top and bottom, `H`/`L` back and forward, `J`/`K` the previous and next tab, `x` closes the tab. `?` shows every shortcut that works on the page.
- **Click without the mouse.** Press `f` and every link, button and field in view gets a label; type a label to click it (or to type into the field). `F` opens the link in a new tab instead. Esc closes the labels, and the characters they use can be changed in the settings.
- **Bind a key to anything on a page.** Click AnyKey's toolbar button, then **Add shortcut for this site**. Point at a button, link or field and click it (or press Tab to move and Enter to pick), then press the keys you want, such as `g` then `s`, and Enter. Pick the next element the same way, and press Esc when you're done. The shortcuts work on every page of that site.
- **Turn AnyKey off for a site** with the switch in the toolbar popup, so every key goes to the site.
- **Settings** (in the popup, **Open settings**) change the built-in keys, add shortcuts for every site or one site, and import or export everything.

## Development

Requires Node 22.12+ and pnpm.

```sh
pnpm install
pnpm build          # production build in dist/chrome-mv3
pnpm dev            # watch build in dist/chrome-mv3-dev
```

Load the build in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `dist/chrome-mv3` (or `dist/chrome-mv3-dev` while `pnpm dev` runs). After a rebuild, click the reload icon on the AnyKey card and reload any open tabs.

## Checks

```sh
pnpm check          # typecheck, lint, em-dash check, unit tests, build
pnpm test:e2e       # Playwright against the built extension
```

The first E2E run needs Playwright's Chromium: `pnpm exec playwright install chromium`.

## Docs

- [CLAUDE.md](CLAUDE.md): architecture and conventions
- [docs/design.md](docs/design.md): design rules and milestones
- [PERMISSIONS.md](PERMISSIONS.md): why each permission is requested
- [BACKLOG.md](BACKLOG.md): ideas left for later, and why they wait
