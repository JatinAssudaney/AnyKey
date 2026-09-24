import React, { Fragment } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, fontFamily } from "../lib/theme";

// The keys pressed, drawn as keycaps like AnyKey draws them: "Shift+F" is two keys held together, "g s" is g then s.

export interface Press {
  /** When the first key goes down, in seconds from the start of the scene. */
  at: number;
  keys: string;
}

/** The time between the keys of a sequence, such as g then s. */
export const SEQUENCE_GAP = 0.3;

const NAMES: Record<string, string> = {
  Shift: "⇧ Shift",
  Alt: "Alt",
  Enter: "Enter ↵",
  Esc: "Esc",
};

const Keycap: React.FC<{ name: string; size: number; downAt: number }> = ({ name, size, downAt }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size,
        height: size,
        padding: `0 ${size * 0.28}px`,
        boxSizing: "border-box",
        borderRadius: size * 0.2,
        border: "2px solid #d6d3d1",
        borderBottomWidth: size * 0.09,
        backgroundColor: "#ffffff",
        color: "#1c1917",
        fontFamily,
        fontWeight: 600,
        fontSize: size * 0.42,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 14px rgb(0 0 0 / 0.18)",
        scale: interpolate(frame, [downAt, downAt + 6], [0.7, 1], { ...CLAMP, easing: Easing.spring({ damping: 12 }) }),
        translate: interpolate(frame, [downAt, downAt + 2, downAt + 7], ["0px 0px", `0px ${size * 0.07}px`, "0px 0px"], CLAMP),
      }}
    >
      {NAMES[name] ?? name}
    </div>
  );
};

/** The last keys pressed, from their press until a little over a second later. */
export const Presses: React.FC<{ presses: Press[]; size: number }> = ({ presses, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let current: Press | undefined;
  for (const press of presses) if (press.at * fps <= frame) current = press;
  if (current === undefined) return null;
  const steps = current.keys.split(" ");
  const start = Math.round(current.at * fps);
  const end = start + Math.round((1.3 + (steps.length - 1) * SEQUENCE_GAP) * fps);
  if (frame > end + 8) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.22,
        opacity: interpolate(frame, [start, start + 3, end, end + 8], [0, 1, 1, 0], CLAMP),
      }}
    >
      {steps.map((step, i) => {
        const downAt = start + Math.round(i * SEQUENCE_GAP * fps);
        if (frame < downAt) return null;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <span style={{ fontFamily, fontWeight: 600, fontSize: size * 0.36, color: "#ffffff" }}>then</span>
            )}
            <div style={{ display: "flex", gap: size * 0.12 }}>
              {step.split("+").map((name) => (
                <Keycap key={name} name={name} size={size} downAt={downAt} />
              ))}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};
