import { staticFile } from "remotion";
import layout from "../../public/frames/layout.json";

// The stills come from `pnpm store:images` in the repository root (e2e/store/video.spec.ts): the real extension on
// the made-up recipe site, captured at 1280 by 720 CSS pixels, 1.5 device pixels each, so 1920 by 1080.

export type FrameName =
  | "page"
  | "page-full"
  | "hints-all"
  | "hints-typed"
  | "hints-picked"
  | "popup"
  | "picker-start"
  | "picker-hover"
  | "picker-panel"
  | "picker-keys"
  | "picker-saved"
  | "picker-toast"
  | "picker-used"
  | "cheatsheet"
  | "settings";

export const frameSrc = (name: FrameName): string =>
  staticFile(`frames/${name}.png`);

export const iconSrc = staticFile("frames/icon.svg");

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoxName = keyof typeof layout.boxes;

/** A box on the captured page, given by name or in CSS pixels, in the video's pixels. */
export function box(target: BoxName | Box): Box {
  const b = typeof target === "string" ? layout.boxes[target] : target;
  const s = layout.scale;
  return { x: b.x * s, y: b.y * s, width: b.width * s, height: b.height * s };
}

export function center(b: Box): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** The two-letter hint the video follows to the salmon recipe, such as "hl". */
export const HINT_LABEL = layout.labels.hint;

/** Where the popup shows over the page: at the top right, below where the toolbar would be. */
export const POPUP: Box = (() => {
  const size = box("popup");
  return { x: 1920 - 24 - size.width, y: 12, width: size.width, height: size.height };
})();

/** The popup's "Add shortcut for this site" button, in the video's pixels. */
export const POPUP_ADD: Box = (() => {
  const add = box("popupAdd");
  return { ...add, x: POPUP.x + add.x, y: POPUP.y + add.y };
})();
