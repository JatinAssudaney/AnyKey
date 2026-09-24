import { loadFont } from "@remotion/google-fonts/Inter";
import { Easing } from "remotion";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

/** AnyKey's orange, from its icon and its pages. */
export const BRAND_GRADIENT = "linear-gradient(135deg, #fb923c 0%, #f97316 45%, #c2410c 100%)";

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** Ease in and out: camera moves and the pointer. */
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Quick out, slow settle: things arriving. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
