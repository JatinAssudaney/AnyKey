# Contributing to AnyKey

Thanks for helping. Bug reports and preset requests go in [issues](https://github.com/JatinAssudaney/AnyKey/issues/new/choose). Pull requests are welcome, and presets are the easiest place to start: a preset is one JSON file and one Playwright test, with no extension code to touch.

## Setup

You need Node 22.12+ and pnpm.

```sh
pnpm install
pnpm exec playwright install chromium   # once, for the browser tests
pnpm check                              # typecheck, lint, preset checks, unit tests, build
pnpm test:e2e                           # Playwright against the built extension
```

To try your build, open `chrome://extensions` (or `brave://extensions`), turn on Developer mode, click Load unpacked and pick `dist/chrome-mv3`. After a rebuild, press the reload button on AnyKey's card.

[CLAUDE.md](CLAUDE.md) describes the architecture and conventions, and [docs/design.md](docs/design.md) the rules key handling, storage and presets keep. Read the Presets section of the design doc before changing a preset.

## Presets

A preset gives a site keys it lacks, and steps aside where the site has its own. Presets live in `presets/<id>.json`, one file per site. The extension finds every file there, so a new site needs no code change.

### What a preset holds

Take `presets/youtube.json` as a model. The schema is `PresetSchema` in `src/core/presets.ts`, and `pnpm test` checks every preset against it.

- `id`: lowercase letters, digits and hyphens. The file is named after it.
- `version`: raise it with every change, or installed copies won't update. `pnpm lint:presets` checks this against `main`.
- `matches`: the site, as Chrome match patterns (`*://www.youtube.com/*`).
- `reserved`: every one of the site's own shortcuts, from its help page or its code, with a label for each. Leave out keys that work only while typing in a text field. Narrow one to some pages with `matches`. Set `yield: true` only on a key that equals one of AnyKey's built-in keys and should reach the site instead (a test checks this).
- `shortcuts`: what the preset adds. Each has an id `preset:<id>:<name>` that never changes (people's changes to a shortcut are keyed by it), keys in canonical notation (`g l`, and `?` rather than `shift+/`), an `action` (most are `click` or `focus` on a `target` with a `selector`, up to three `fallbacks` and a last-resort `text`, or `navigate` to a `url`), a `label`, and `verified`.
- A shortcut's keys must not be any of the site's keys, or the start of one: the unit tests reject a preset that clashes.

Every new or changed shortcut ships with `verified: false`. It becomes `true` once the live test passes and the checks that need an account (below) have been done by hand.

### Testing a preset with Playwright

Each preset has a live test, `e2e/live/<id>.spec.ts`, which loads the built extension into Chromium, opens the real site signed out, and presses the preset's keys. `pnpm lint:presets` fails for a preset without one (the few exceptions, such as Reddit, which shows automated browsers a reCAPTCHA page, are listed in `scripts/check-presets.ts` with the reason).

A test checks two things:

1. **Each shortcut finds its element.** Press its keys and wait for what it does: a page opens, a menu shows. `toast(page)` returns AnyKey's toast, which appears when a shortcut finds nothing, so expect it to be `null`.
2. **Each key that gives way reaches the site.** Press it on a page where it yields and check the site acted. On a page where it doesn't yield, check that AnyKey's shortcut ran instead.

The helpers in `e2e/live/live.ts` deal with live pages, which go on loading after their load event: `openOnSite(page, url, 'YouTube')` waits until AnyKey runs there with the preset, `press(page, 'g', 'l')` presses a sequence, and `recordPageKeys` with `pageKeys` (from `e2e/harness.ts`) lists the keys the page itself received. `pressUntil` in the harness presses until a site that sets up its keys late answers. `e2e/live/github.spec.ts` uses all of them.

```ts
import { expect, test, waitForPresets } from '../harness.ts';
import { openOnSite, press, toast } from './live.ts';

test.beforeEach(async ({ extensionContext, extensionId }) => {
  await waitForPresets(extensionContext, extensionId);
});

test("the Example preset's shortcuts", async ({ page }) => {
  await openOnSite(page, 'https://example.com/', 'Example');
  await press(page, 'g', 'h');
  await page.waitForURL('https://example.com/help');
  expect(await toast(page)).toBeNull();
});
```

Run it against the build:

```sh
pnpm build
pnpm exec playwright test -c playwright.live.config.ts e2e/live/<id>.spec.ts
```

On a failure, `pnpm exec playwright show-trace test-results/<test>/trace.zip` shows each step with the page as it was.

What a test can't reach signed out (liking, subscribing, pages for admins or moderators) is checked by hand: add the preset's tables to [docs/preset-checklist.md](docs/preset-checklist.md) and follow its steps.

### What CI runs

Every pull request runs `pnpm check` and `pnpm test:e2e`. A pull request that changes `presets/` or `e2e/live/` also runs the live tests for the presets it touches, against the real sites (the "Presets on live sites" workflow). The same workflow runs every preset weekly, to catch sites that changed under them. A first-time contributor's workflows start once a maintainer approves them.

If a live test fails in CI but passes on your machine, the site may show a GitHub Actions runner something else (a consent page, a different layout in another region). Say so in the pull request, with the trace from the workflow's `live-test-results` artifact.

## Style

- No em dashes anywhere (code, comments, docs, commit messages): use commas, colons, periods or parentheses. `pnpm lint:text` checks.
- TypeScript is strict, and `any` is a lint error.
- Commit messages: a summary line, then a body saying why.
