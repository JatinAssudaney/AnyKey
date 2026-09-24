# Chrome Web Store listing

What to enter in the developer dashboard for AnyKey, field by field. The images in `images/` come from `pnpm store:images`; run it again when the UI they show changes.

## Store listing tab

**Title:** AnyKey (the manifest's `name`).

**Summary:** the manifest's `description` (`APP_DESCRIPTION` in `src/core/app.ts`, at most 132 characters):

> Make any website keyboard-navigable: bind keys to any element, link hints, scroll keys and site presets.

**Description** (plain text; the store keeps line breaks):

```text
AnyKey lets you use any website from the keyboard. Scroll, follow links, press buttons and move between tabs without reaching for the mouse, and give a key to anything on a page: the Save button on a recipe site, the Like button under a video, the search box you use every day. Presets for GitHub, YouTube and Reddit add keys those sites lack, and step aside where a site already uses a key. Your own shortcuts always win.

• Keys on every site: j and k scroll, d and u move half a page, g g and G go to the top and bottom, H and L go back and forward, J and K switch tabs.
• Link hints: press F and every link and button in view gets a short label. Type the label to click it. Press g f instead to open a link in a new tab.
• A key for anything: click AnyKey's toolbar button, choose "Add shortcut for this site", pick the element and press the keys you want. AnyKey remembers each element several ways, so a shortcut can still find it after the site changes its page.
• Presets for GitHub, YouTube and Reddit: g r opens a repository's releases, g l likes a video, g s subscribes to a channel. Where the site has its own key, such as YouTube's j and k on a video, the key goes to the site.
• Press ? on any page to see every shortcut that works there, starting with the site's own on GitHub, YouTube and Reddit.
• Change any key, switch any shortcut off, or turn AnyKey off for a site. Warnings say when two shortcuts clash or the browser keeps a key for itself. Settings sync with your browser, and export to a file.
• Alt+Shift+K (Option+Shift+K on a Mac) opens AnyKey's panel from any tab.

AnyKey collects no data and makes no network requests. Your shortcuts stay in your browser.
```

**Category:** Accessibility: AnyKey's purpose is using the web without a mouse. Functionality & UI fits too, if the store's reviewers or search suggest it.

**Language:** English.

**Graphic assets** (all in `images/`):

| Field | File |
|---|---|
| Store icon, 128×128 | `icon-128.png` |
| Screenshots, 1280×800, in this order | `screenshot-1-hints.png`, `screenshot-2-picker.png`, `screenshot-3-popup.png`, `screenshot-4-cheatsheet.png`, `screenshot-5-presets.png` |
| Small promo tile, 440×280 | `promo-small.png` |
| Marquee promo tile, 1400×560 | `promo-marquee.png` |
| YouTube video | none yet: render one from `video/` and upload it (see `docs/launch.md`) |

**Homepage URL:** https://github.com/JatinAssudaney/AnyKey

**Support URL:** https://github.com/JatinAssudaney/AnyKey/issues

## Privacy tab

- **Single purpose** and **permission justifications:** copy them from PERMISSIONS.md (Single purpose, then each row of Requested; the content script's row answers the host permission).
- **Remote code:** No, AnyKey doesn't use remote code (PERMISSIONS.md, Remote code and data use).
- **Data usage:** tick no data type: AnyKey sends nothing anywhere. Tick all three certifications (no selling or transfer, no use unrelated to the single purpose, no use for credit decisions).
- **Privacy policy URL:** https://github.com/JatinAssudaney/AnyKey/blob/main/PRIVACY.md

When a permission or what AnyKey stores changes, update PERMISSIONS.md, PRIVACY.md and this page together.
