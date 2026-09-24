import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { iconSrc } from "../lib/frames";
import { BRAND_GRADIENT, fontFamily } from "../lib/theme";

// The opening and closing cards: AnyKey's icon and name on its orange.

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: BRAND_GRADIENT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        color: "#ffffff",
      }}
    >
      <Img
        name="Icon"
        src={iconSrc}
        style={{
          width: 260,
          height: 260,
          filter: "drop-shadow(0 20px 30px rgb(67 20 7 / 0.35))",
          scale: interpolate(frame, [0, 0.6 * fps], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 0.2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Name"
        style={{
          marginTop: 36,
          fontSize: 150,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          opacity: interpolate(frame, [0.35 * fps, 0.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [0.35 * fps, 0.9 * fps], ["0px 30px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        AnyKey
      </Interactive.Div>
      <Interactive.Div
        name="Tagline"
        style={{
          marginTop: 28,
          fontSize: 58,
          fontWeight: 600,
          opacity: interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Use any website from the keyboard
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: BRAND_GRADIENT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <Img
          name="Icon"
          src={iconSrc}
          style={{
            width: 200,
            height: 200,
            filter: "drop-shadow(0 16px 24px rgb(67 20 7 / 0.35))",
            scale: interpolate(frame, [0, 0.5 * fps], [0.7, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 14 }),
              output: "perceptual-scale",
            }),
          }}
        />
        <Interactive.Div
          name="Name"
          style={{
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            opacity: interpolate(frame, [0.15 * fps, 0.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          AnyKey
        </Interactive.Div>
      </div>
      <Interactive.Div
        name="Tagline"
        style={{
          marginTop: 40,
          fontSize: 58,
          fontWeight: 600,
          opacity: interpolate(frame, [0.5 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Keyboard shortcuts for any website
      </Interactive.Div>
      <Interactive.Div
        name="Store"
        style={{
          marginTop: 56,
          padding: "18px 40px",
          borderRadius: 999,
          backgroundColor: "#ffffff",
          color: "#9a3412",
          fontSize: 44,
          fontWeight: 800,
          boxShadow: "0 12px 30px rgb(67 20 7 / 0.3)",
          opacity: interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [1 * fps, 1.6 * fps], ["0px 20px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        On the Chrome Web Store
      </Interactive.Div>
    </AbsoluteFill>
  );
};
