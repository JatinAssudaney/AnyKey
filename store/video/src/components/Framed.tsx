import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BRAND_GRADIENT, CLAMP, fontFamily } from "../lib/theme";
import { Presses, type Press } from "./Keys";

// Every scene's frame: the screen in a browser window on AnyKey's orange, under the scene's headline and the keys
// pressed.

/** The screen, drawn at 1920 by 1080 and scaled into a box. */
const Scaled: React.FC<{ scale: number; children: React.ReactNode }> = ({ scale, children }) => (
  <div style={{ position: "relative", width: 1920 * scale, height: 1080 * scale, overflow: "hidden" }}>
    <div style={{ position: "absolute", width: 1920, height: 1080, scale: String(scale), transformOrigin: "0 0" }}>
      {children}
    </div>
  </div>
);

export const Framed: React.FC<{ headline: string; presses: Press[]; children: React.ReactNode }> = ({
  headline,
  presses,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundImage: BRAND_GRADIENT }}>
      <div
        style={{
          position: "absolute",
          left: 269,
          right: 269,
          top: 40,
          height: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 800,
            fontSize: 64,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            textShadow: "0 3px 12px rgb(67 20 7 / 0.35)",
            opacity: interpolate(frame, [6, 18], [0, 1], CLAMP),
            translate: interpolate(frame, [6, 20], ["0px 16px", "0px 0px"], CLAMP),
          }}
        >
          {headline}
        </div>
        <Presses presses={presses} size={64} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 269,
          top: 214,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          boxShadow: "0 30px 80px rgb(67 20 7 / 0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 44,
            padding: "0 18px",
            backgroundColor: "#f5f5f4",
            borderBottom: "1px solid #e7e5e4",
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#ef4444" }} />
          <span style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#f59e0b" }} />
          <span style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#22c55e" }} />
          <span style={{ width: 520, height: 24, marginLeft: 24, borderRadius: 12, backgroundColor: "#e7e5e4" }} />
        </div>
        <Scaled scale={0.72}>{children}</Scaled>
      </div>
    </AbsoluteFill>
  );
};
