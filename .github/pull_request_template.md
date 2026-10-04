<!-- What this changes, and why. Link the issue it closes, if any. -->

## Checks

- [ ] `pnpm check` passes
- [ ] `pnpm test:e2e` passes, if extension code changed

### For a preset change (see CONTRIBUTING.md#presets)

- [ ] `version` is higher than on `main`
- [ ] `e2e/live/<id>.spec.ts` covers the new or changed shortcuts and keys that give way, and passes locally
- [ ] The site's own shortcuts are listed in `reserved` (link to the site's shortcut list: )
- [ ] What needs an account is in `docs/preset-checklist.md`, and I checked it by hand (or say what is unchecked)
- [ ] `verified: true` only on shortcuts checked both signed in and signed out
