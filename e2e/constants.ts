export const FIXTURE_PORT = 4178;
export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

/**
 * Which system the browser says it runs on. AnyKey reads it from the user agent: `mod` is Cmd on macOS and Ctrl
 * elsewhere, and keys are named with symbols (⌘⇧K) on macOS and in words (Ctrl+Shift+K) elsewhere. `host` is the
 * machine the tests run on; `windows` is the `windows` project in playwright.config.ts, for AnyKey's Windows paths
 * without a Windows machine. What Windows itself does (AltGr, the keys its browsers keep) it can't show.
 */
export type Platform = 'host' | 'windows';
