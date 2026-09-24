# AnyKey privacy policy

Effective 24 September 2026.

AnyKey is a browser extension that makes websites keyboard-navigable. It collects no data: nothing it reads or stores is sent to its developer or to anyone else, and it makes no network requests of its own.

## What AnyKey reads on the pages you visit

AnyKey runs on every page so its keys work everywhere. When it is installed or updated, it also starts in the tabs you already have open, so they work without a reload. On each page it:

- reads the page's address, to tell which of your shortcuts work there;
- listens for key presses, to tell whether they match one of your shortcuts. In text fields only the shortcuts you allowed there act;
- looks at the page's links, buttons and other elements, to click or focus the ones your shortcuts name, and to draw link hints;
- when you pick an element for a new shortcut, reads that element's attributes and text to describe it, so the shortcut can find it again.

All of this happens in your browser. None of it is recorded, except the description of an element you pick, which is saved with that shortcut.

## What AnyKey stores

In your browser's extension storage:

- your shortcuts (with the element descriptions above), your settings, the sites where you turned AnyKey off, and your changes to the site presets. If you turned on your browser's sync, the browser syncs these between your devices through your browser account, as it does for other extensions' settings. The developer has no access to them;
- a backup of your settings, made before an import replaces them, on this device only;
- the site presets that come with AnyKey (for GitHub, YouTube and Reddit), on this device only;
- while you pick an element, which tab you are picking in, until the browser closes.

You can export your settings to a file from AnyKey's settings page. The file is saved only where you choose.

## What AnyKey doesn't do

- It has no analytics, tracking, advertising or remote code.
- It doesn't sell, share or transfer any data, and doesn't use any for purposes unrelated to its keyboard shortcuts.
- It doesn't read your browsing history, or the addresses and titles of your other tabs.

## Deleting your data

Uninstalling AnyKey removes what it stored in your browser. Settings your browser synced are covered by your browser's own sync settings, where you can clear synced data. Without uninstalling, you can delete any shortcut, reset a site, or replace everything by importing a settings file, all from AnyKey's settings page.

## Changes and contact

If this policy changes, the new version will be published here with a new effective date. Questions and problem reports: [github.com/JatinAssudaney/AnyKey/issues](https://github.com/JatinAssudaney/AnyKey/issues).
