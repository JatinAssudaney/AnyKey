# AnyKey's demo video

A [Remotion](https://www.remotion.dev) project that makes the Chrome Web Store's demo video from stills of AnyKey at work on the demo page (`store/demo.html`): 40 seconds at 1920×1080 and 30 fps. Each scene shows the page in a browser window on AnyKey's orange, under a headline and the keys pressed:

1. The title card.
2. Scrolling with `j`, `d` and `g g`.
3. Link hints: `F`, then typing a label.
4. Giving the Save button a key from the popup and the picker, then pressing it.
5. The cheatsheet, with the new shortcut.
6. The presets in the settings.
7. The end card.

## Make it

```sh
pnpm store:images    # in the repository root: the stills, into public/frames
npm install          # here, once
npm run dev          # Remotion Studio, to watch it
npx remotion render Demo out/anykey-demo.mp4
```

The README's GIF of link hints (`.github/hints.gif`) is the Hints scene on its own, at half size and 15 fps:

```sh
npx remotion render Hints ../../.github/hints.gif --codec=gif --scale=0.5 --every-nth-frame=2
```

The stills are captured, not recorded: `e2e/store/video.spec.ts` drives the real extension on the demo page and saves a PNG at each step, plus `layout.json`, which says where the buttons, the picker's panel and the popup were, so the pointer and the camera find them. Make the stills again when the UI they show changes, and the video follows.

`src/Demo.tsx` lists the scenes and their lengths, and each scene (`src/scenes/`) sets its own timing in seconds. The Studio also has each scene on its own, under Scenes.

## Notes

- `npm run lint` runs ESLint and tsc. The repository's own lint and typecheck skip this folder, since it has its own dependencies.
- Remotion is free for individuals and for companies of up to 3 people. A larger company needs a [company license](https://www.remotion.dev/license).
