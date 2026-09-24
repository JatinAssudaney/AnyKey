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
- [x] Permissions: `storage`, `scripting` and host access to every site, each for a reason PERMISSIONS.md gives, and no install warning beyond the one a content script on every site brings.
- [x] No remote code, and no `eval` or `new Function` in any bundle.
- [x] AnyKey sends nothing anywhere. Settings sync through the browser's own sync.
- [x] A page where AnyKey was used (scrolled, cheatsheet opened) still goes into the back/forward cache: AnyKey has no `unload` handler and keeps no port open.
- [x] No errors or warnings in the console of a web page, the popup, the options page or the service worker.
- [x] End-to-end tests (Playwright) as well as unit tests.
- [x] M10: the back/forward cache and console checks run as E2E tests (`e2e/release.spec.ts`), so no later change undoes them.

## Onboarding (M7)

- [x] A welcome page opens when AnyKey is installed, and never on an update.
- [x] AnyKey's keys work on the welcome page itself, so people can try them where they read about them.
- [x] It teaches the popup's key and how to give anything on a page a key. The tabs open before the install need no reload: AnyKey starts in them.

## Presets (M8)

- [x] `pnpm test:live` checks the GitHub and YouTube presets on the live sites, signed out.
- [x] GitHub and YouTube pass `docs/preset-checklist.md` on the live sites, signed in and signed out, and are marked `verified: true` (GitHub version 3, YouTube version 2).
- [x] Reddit passes the checklist by hand and is marked `verified: true` (version 2), so no Unverified badge is left for a reviewer to see.

## Store listing (M9)

Images, all PNG, made by `pnpm store:images` into `store/images` (`store/listing.md` says which goes where):

- [x] Store icon, 128×128: the artwork 96×96 in the middle and 16 px clear on each side, working on light and dark backgrounds. The toolbar icon fills its square (120×118 of 128), so the listing gets its own.
- [x] 1 to 5 screenshots, 1280×800, full bleed with square corners, showing the real UI: five, on a made-up recipe site (`store/demo.html`) and AnyKey's own pages. Made again after M8, without Unverified badges.
- [x] Small promo tile, 440×280 (required): no text, saturated colors, clear at half size.
- [x] Marquee, 1400×560: optional, but the store's carousel shows only items that have one.
- [x] A short demo video on YouTube (recommended): made in `store/video` (Remotion) from stills of AnyKey on the demo page, 40 seconds, and rendered after M8 into `store/video/out/anykey-demo.mp4`. On YouTube at https://youtu.be/DBxblfXS87c, in the listing.

Text, ready to paste in `store/listing.md`:

- [x] Title: the manifest name, AnyKey. The address bar shows it on AnyKey's pages, so it stays short, and the summary says what AnyKey does.
- [x] Summary: the manifest description, at most 132 characters (104 now).
- [x] Description: an overview paragraph, then the features. No lists of keywords.
- [x] Category: Accessibility.
- [x] Privacy practices: the single purpose and the permission justifications from PERMISSIONS.md, and what AnyKey does with data, matching the privacy policy.
- [x] A privacy policy, a website and a support page, at public URLs: [PRIVACY.md](https://github.com/JatinAssudaney/AnyKey/blob/main/PRIVACY.md), [the repository](https://github.com/JatinAssudaney/AnyKey) and [its Issues](https://github.com/JatinAssudaney/AnyKey/issues).

## Release (M10)

- [x] Version 1.0.0.
- [ ] A manual test pass in Google Chrome on macOS (so far: Brave): install Chrome, load `dist/chrome-mv3` unpacked at `chrome://extensions`, and go through the manual lists.
- [x] Windows, without a Windows machine: every E2E test also runs as Windows (the `windows` project in `playwright.config.ts`), with a Windows user agent, which takes AnyKey's own Windows paths (Ctrl where a Mac has Cmd, the keycaps, the key recorder). What only Windows itself shows stays unchecked: AltGr keyboards, and the keys Chrome on Windows keeps (Ctrl+W, Ctrl+Tab and the rest listed in `src/core/conflicts.ts`). A friend's PC for a quarter of an hour, or a Windows virtual machine on the Mac (UTM or Parallels), would cover them; otherwise Issues will.
- [x] `pnpm zip`, for the upload: `dist/anykey-1.0.0-chrome.zip`, about 200 kB.

### Developer account (by hand, start early)

Registering is quick, but the email checks take a while. From [Register your developer account](https://developer.chrome.com/docs/webstore/register) and [Set up your account](https://developer.chrome.com/docs/webstore/set-up-account):

- [x] Choose the Google account to publish with. Its email can't be changed once registered (moving means a new account and transferring AnyKey to it), so Google suggests an account just for publishing, one you check often: store alerts and review results go there.
- [ ] Turn on [2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification) for that account (Google Account, Security). The store requires it before the first publish and before every update.
- [x] Open the [developer dashboard](https://chrome.google.com/webstore/devconsole), accept the developer agreement and policies, and pay the one-time registration fee.
- [ ] In the dashboard's Account page, fill in the publisher name (shown under AnyKey's title in the store) and the contact email, then click the verification link Google sends to it. No physical address: AnyKey sells nothing.
- [ ] Declare yourself a [trader or a non-trader](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure) (EU consumer law): a trader publishes for a trade, business or profession and gives a verified legal name and contact details; a non-trader publishes outside one. It is your declaration to make.

### Submit (by hand)

- [x] Upload the demo video to YouTube (public or unlisted), and send me its link for `store/listing.md`.
- [x] In the dashboard: Add new item, then upload the zip from `pnpm zip` (`dist/anykey-1.0.0-chrome.zip`).
- [x] Store listing tab: paste the text from `store/listing.md`, upload the images from `store/images`, and add the video's link.
- [x] Privacy tab: as `store/listing.md` says (single purpose, the permission justifications, no remote code, the data use boxes, and PRIVACY.md's URL).
- [x] Distribution: free, public, every region.
- [x] Test instructions (optional, for the reviewer): as `store/listing.md` says.
- [x] Submit for review. The dashboard emails the result; a rejection names the policy, and what to fix goes into a new upload. Submitted on 25 September 2026, version 1.0.0.
- [ ] Once AnyKey is public: nominate it for the Featured badge (see The Featured badge, above).
- [ ] Once AnyKey is public: send me its store link, for README.md (Install, and the badge in place of "in review") and the repository's About website.
