# Launch

What the Chrome Web Store asks of AnyKey, for publishing and for its Featured badge, and which milestone (M7 to M10 in `docs/design.md`) covers each part. Tick an item when it is done.

## The Featured badge

Featured extensions "follow our technical best practices and meet a high standard of user experience and design". The store's team reviews each one by hand, and no one can pay for the badge.

Once AnyKey is public, nominate it from the [One Stop Support](https://support.google.com/chrome_webstore/contact/one_stop_support) page ("I want to nominate my extension…", offered as a trial). A nomination needs:

- an extension that the nominating account owns;
- English language support;
- the extension published and public;
- no active policy violations;
- core features that work without an account or a payment.

The Established publisher badge takes no work of ours: it comes once the publisher's identity is verified and the account has a positive track record with Google services.

Sources: [badges](https://support.google.com/chrome_webstore/answer/1050673#cws_badges), [discovery](https://developer.chrome.com/docs/webstore/discovery), [best practices](https://developer.chrome.com/docs/webstore/best_practices/), [images](https://developer.chrome.com/docs/webstore/images), [a great listing](https://developer.chrome.com/docs/webstore/best_listing).

## Technical best practices

Checked on 2026-09-24:

- [x] Manifest V3, with a service worker.
- [x] Permissions: `storage` and the content script, nothing else (see PERMISSIONS.md).
- [x] No remote code, and no `eval` or `new Function` in any bundle.
- [x] AnyKey sends nothing anywhere. Settings sync through the browser's own sync.
- [x] A page where AnyKey was used (scrolled, cheatsheet opened) still goes into the back/forward cache: AnyKey has no `unload` handler and keeps no port open.
- [x] No errors or warnings in the console of a web page, the popup, the options page or the service worker.
- [x] End-to-end tests (Playwright) as well as unit tests.
- [ ] M10: the back/forward cache and console checks run as E2E tests, so no later change undoes them.

## Onboarding (M7)

- [x] A welcome page opens when AnyKey is installed, and never on an update.
- [x] AnyKey's keys work on the welcome page itself, so people can try them where they read about them.
- [x] It teaches the popup's key and how to give anything on a page a key, and says that tabs open before the install need a reload.

## Presets (M8)

- [ ] Every preset shortcut passes `docs/preset-checklist.md` on its live site, signed in and signed out, and is marked `verified: true`, so no Unverified badge is left for a reviewer to see.

## Store listing (M9)

Images, all PNG:

- [ ] Store icon, 128×128: the artwork 96×96 in the middle and 16 px clear on each side, working on light and dark backgrounds. The toolbar icon fills its square (120×118 of 128), so the listing gets its own.
- [ ] 1 to 5 screenshots, 1280×800, full bleed with square corners, showing the real UI.
- [ ] Small promo tile, 440×280 (required): no text, saturated colors, clear at half size.
- [ ] Marquee, 1400×560: optional, but the store's carousel shows only items that have one.
- [ ] A short demo video on YouTube (recommended).

Text:

- [ ] Title: the manifest name, AnyKey. The address bar shows it on AnyKey's pages, so it stays short, and the summary says what AnyKey does.
- [ ] Summary: the manifest description, at most 132 characters (104 now).
- [ ] Description: an overview paragraph, then the features. No lists of keywords.
- [ ] Category: Accessibility, or Workflow & Planning.
- [ ] Privacy practices: the single purpose and the permission justifications from PERMISSIONS.md, and what AnyKey does with data, matching the privacy policy.
- [ ] A privacy policy, a website and a support page, at public URLs.

## Release (M10)

- [ ] Version 1.0.0.
- [ ] A manual test pass on Windows and in Google Chrome (so far: Brave on macOS), where key handling differs: Ctrl for Cmd, AltGr, and the keys the browser keeps.
- [ ] A developer account: the registration fee and identity verification.
- [ ] `pnpm zip`, upload, fill in the listing, and submit for review.
- [ ] Once AnyKey is public: nominate it for the Featured badge.

## Open question

Starting AnyKey from the toolbar icon in tabs that were open before an install or update (`activeTab` and `scripting`, which add no install warning) would fix those tabs without a reload. BACKLOG.md has the options. The badge doesn't need it, and it adds permissions, so it waits for a decision.
