# AnyKey

A Chrome extension that makes any website keyboard-navigable: bind a key to any element, use Vimium-style link hints and scroll keys everywhere, and get shortcut presets for popular sites. Your settings always override presets.

## Using it

- **Scroll and move around** on any page: `j`/`k` scroll, `d`/`u` half a page, `g g` and `G` the top and bottom, `H`/`L` back and forward, `J`/`K` the previous and next tab, `x` closes the tab. `?` shows every shortcut that works on the page, starting with the site's own keys on sites with a preset.
- **Click without the mouse.** Press `F` (Shift+F) and every link, button and field in view gets a label; type a label to click it (or to type into the field). `g f` opens the link in a new tab instead. While the labels show, AnyKey is in hint mode: keys pick labels instead of running your shortcuts, until you pick one or press Esc. The characters labels use can be changed in the settings. Plain `f` stays with the site, so it still means fullscreen on YouTube.
- **Bind a key to anything on a page.** Click AnyKey's toolbar button, then **Add shortcut for this site**. Point at a button, link or field and click it (or press Tab to move and Enter to pick), then press the keys you want, such as `g` then `s`, and Enter. Pick the next element the same way, and press Esc when you're done. The shortcuts work on every page of that site.
- **Presets for GitHub, YouTube and Reddit** add shortcuts those sites lack, such as `g r` for a GitHub repository's releases and `g l` to like a YouTube video, and leave the sites' own keys to them: on a YouTube video, `j` and `k` seek and pause as YouTube intends, and scroll everywhere else. The popup lists what applies to the page, and the settings let you change or switch off any preset shortcut, or keep AnyKey's own key on a site. Your shortcuts always win over a preset's.
- **Turn AnyKey off for a site** with the switch in the toolbar popup, so every key goes to the site.
- **Open the popup from the keyboard** with Alt+Shift+K (⌥⇧K on a Mac), in any tab. The browser keeps this key: if another extension already has it, or to pick another, set it at `chrome://extensions/shortcuts` (Settings links there).
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
pnpm test:live      # the GitHub and YouTube presets on the live sites, signed out
pnpm store:images   # the Chrome Web Store images, into store/images, and the demo video's stills
```

The first E2E run needs Playwright's Chromium: `pnpm exec playwright install chromium`.

## Docs

- [CLAUDE.md](CLAUDE.md): architecture and conventions
- [docs/design.md](docs/design.md): design rules and milestones
- [docs/preset-checklist.md](docs/preset-checklist.md): how to check a preset on the live site
- [PERMISSIONS.md](PERMISSIONS.md): why each permission is requested
- [PRIVACY.md](PRIVACY.md): the privacy policy
- [store/listing.md](store/listing.md): the Chrome Web Store listing, field by field
- [store/video/README.md](store/video/README.md): the demo video, and how to make it
- [BACKLOG.md](BACKLOG.md): ideas left for later, and why they wait
