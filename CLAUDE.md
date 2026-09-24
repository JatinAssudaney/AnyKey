# AnyKey

Chrome MV3 extension that makes any website keyboard-navigable: bind a key to any element, Vimium-style link hints and scroll keys, and shortcut presets for popular sites. User settings always override presets. Built with WXT 0.21, TypeScript, React 19 + Tailwind 4 (extension pages only), Vitest and Playwright.

## Architecture

- `src/core/`: pure logic (key parsing, sequence matching, shortcut resolution, selector scoring, zod schemas). Type-checked against the ECMAScript library alone (`tsconfig.core.json`), so any DOM, `chrome.*` or Node global fails `pnpm typecheck`. Callers pass platform facts in: `isMac`, parsed URL parts, the current time.
- `src/dom/`: content-script code: key engine, action executor, picker, hints. In-page UI lives in `src/dom/ui/`.
- `src/background/`: service-worker code: the validating message router and tab actions.
- `src/storage/`: storage reads, pure mutation reducers, and the background write queue.
- `src/messaging.ts`: the sending side of runtime messages, shared by the content script and extension pages.
- `src/entrypoints/`: WXT entrypoints (background, content, popup, options). Thin: they wire modules together.
- `src/components/`: React components shared by the popup and options page.
- `presets/`: bundled preset JSON. `e2e/`: Playwright specs, harness and fixture pages.

Imports flow one way: entrypoints, then dom / background / components, then storage, then `messaging.ts`, then core. Core imports from no other layer.

**Before changing key handling, shortcut resolution, storage, presets, the picker or hints, read `docs/design.md`.** It holds the rules those areas must keep: when a key is consumed, the single-writer storage model, preset yield rules, and more. Update it in the same change when a rule changes.

## Conventions

- TypeScript strict; `any` is a lint error. Validate every trust boundary with zod: stored data, imported JSON, presets, runtime messages. Schemas use `zod/mini` (`z.string().check(z.maxLength(n, message))`), which has no default messages, so any check a user can fail carries its own.
- Explicit imports (auto-imports are off): `browser` from `wxt/browser`, WXT helpers from `wxt/utils/...`. Call extension APIs through `browser.*`, which tests fake with `fakeBrowser`.
- In-page UI is vanilla TypeScript + plain CSS in px units, rendered in the one shared shadow root, with text set through `textContent` (the `h()` helper in `src/dom/ui/h.ts`). React and Tailwind belong to the popup and options page.
- The content script loads on every page, so keep it small: it carries only the schemas it parses stored data with, and code only extension pages need (mutation reducers, import, export) stays out of `src/dom/`'s imports. Check `content.js` in the `pnpm build` output when adding dependencies (M3: 66 kB, 22.8 kB gzipped; zod/mini is about 26 kB of that).
- Permissions stay at `storage` plus the `<all_urls>` content script, so people aren't put off installing. Adding one needs the user's approval and updates to PERMISSIONS.md and `e2e/extension.spec.ts` (which pins the manifest). Deferred ideas go in `BACKLOG.md`, with why they wait.
- The popup and options page are keyboard-first: every control reachable with Tab in visual order, visible `focus-visible` rings, a label on every input, native `<dialog>` for modals, `aria-live` for status. jsx-a11y runs in strict mode.
- Tests sit next to the code as `*.test.ts(x)`. Pure logic gets unit tests; DOM tests opt in with `// @vitest-environment happy-dom`; real-browser behavior gets a Playwright spec in `e2e/`.
- Writing style everywhere (code, comments, docs, UI copy, commit messages): use commas, colons, periods or parentheses where an em dash (U+2014) might go. `pnpm lint:text` fails on any em dash.
- Commit messages are plain: summary line plus body, no Co-Authored-By trailer.

## Gotchas

- TypeScript stays on 6.0: typescript-eslint requires `<6.1`. ESLint 10 is paired with `eslint-plugin-jsx-a11y-x`, a maintained fork (the original plugin stops at ESLint 9, which is end of life).
- Vitest stays on 4.1: WXT's test plugin is untested on Vitest 5.
- WXT 0.21 removed the `wxt/testing` barrel. Import `WxtVitest` from `wxt/testing/vitest-plugin` and `fakeBrowser` from `wxt/testing/fake-browser`. fakeBrowser's `storage.sync.getBytesInUse` throws, so stub it.
- Branded Chrome 137+ ignores `--load-extension`, so `pnpm dev` launches no browser: load `dist/chrome-mv3-dev` (dev) or `dist/chrome-mv3` (build) unpacked by hand. E2E uses Playwright's bundled Chromium (first run: `pnpm exec playwright install chromium`).
- Background message listeners answer with `sendResponse` + `return true`; promise-returning listeners need Chrome 148+ and break under fakeBrowser.
- E2E can't see into AnyKey's closed shadow root with locators or `page.evaluate`: read it through the DevTools protocol (`DOM.getDocument` with `pierce: true`), as `openCheatsheetText` in `e2e/harness.ts` does.
- After `chrome.runtime.reload()` the new service worker starts only when an event needs it, so E2E waits for the old worker's `close` event, never for a new `serviceworker` event.
- E2E tests share one browser profile per worker. The harness clears storage before each test, so a test that changes settings must wait until storage holds the change (the writer saves up to about a second later), or the write lands in the next test.

## Milestone loop

The build is split into milestones M1 to M6 (listed in `docs/design.md`). Each one ends with `pnpm check` and `pnpm test:e2e` green, load-unpacked steps plus a manual test list for the user, a commit, and a stop for the user's review before the next milestone starts.
