# AnyKey: Keyboard Shortcuts for Any Website

A Chrome extension that makes any website keyboard-navigable: bind a key to any element, use Vimium-style link hints and scroll keys everywhere, and get shortcut presets for popular sites. Your settings always override presets.

## Development

Requires Node 22.12+ and pnpm.

```sh
pnpm install
pnpm build          # production build in .output/chrome-mv3
pnpm dev            # watch build in .output/chrome-mv3-dev
```

Load the build in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick `.output/chrome-mv3` (or `.output/chrome-mv3-dev` while `pnpm dev` runs). After a rebuild, click the reload icon on the AnyKey card and reload any open tabs.

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
