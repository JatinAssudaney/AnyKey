import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { box, center, frameSrc, POPUP, type Box, type BoxName, type FrameName } from "../lib/frames";
import { CLAMP, EASE_IN_OUT, EASE_OUT } from "../lib/theme";

// What happens on the screen: the captured stills in turn, a camera that moves in on what matters, the popup, the
// pointer and the page scrolling. Times are in seconds from the start of the scene.

export interface Step {
  at: number;
  still: FrameName;
}

/** Each still from its time on, over the one before: a change in AnyKey's UI is quick, so the fade is short. */
export const Stills: React.FC<{ steps: Step[] }> = ({ steps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {steps.map((step, i) => {
        const start = Math.round(step.at * fps);
        if (i > 0 && frame < start) return null;
        return (
          <Img
            key={i}
            src={frameSrc(step.still)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: i === 0 ? 1 : interpolate(frame, [start, start + 4], [0, 1], CLAMP),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export interface Shot {
  at: number;
  /** 1 shows the whole screen. */
  zoom: number;
  /** What to center, by name or in CSS pixels. */
  target?: BoxName | Box;
}

interface View {
  z: number;
  x: number;
  y: number;
}

function view(shot: Shot, width: number, height: number): View {
  if (shot.target === undefined || shot.zoom <= 1) return { z: 1, x: 0, y: 0 };
  const z = shot.zoom;
  const c = center(box(shot.target));
  const clamp = (value: number, min: number) => Math.min(0, Math.max(min, value));
  return { z, x: clamp(width / 2 - c.x * z, width - width * z), y: clamp(height / 2 - c.y * z, height - height * z) };
}

/** Moves in on a part of the screen and back out, never showing past its edges. */
export const Camera: React.FC<{ shots: Shot[]; children: React.ReactNode }> = ({ shots, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  let index = 0;
  shots.forEach((shot, i) => {
    if (shot.at * fps <= frame) index = i;
  });
  const shot = shots[index];
  const to = view(shot, width, height);
  const from = index > 0 ? view(shots[index - 1], width, height) : to;
  const start = Math.round(shot.at * fps);
  const t = interpolate(frame, [start, start + Math.round(0.7 * fps)], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
  const mix = (a: number, b: number) => a + (b - a) * t;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(${mix(from.x, to.x)}px, ${mix(from.y, to.y)}px) scale(${mix(from.z, to.z)})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export interface ScrollTo {
  at: number;
  /** How far down the page, in CSS pixels. */
  y: number;
}

/** The whole page, scrolled as AnyKey scrolls it: smoothly, to each position in turn. */
export const ScrollingPage: React.FC<{ positions: ScrollTo[] }> = ({ positions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let y = positions[0]?.y ?? 0;
  positions.forEach((position, i) => {
    if (i === 0) return;
    const start = Math.round(position.at * fps);
    const previous = positions[i - 1].y;
    if (frame >= start) {
      y = interpolate(frame, [start, start + Math.round(0.3 * fps)], [previous, position.y], { ...CLAMP, easing: EASE_OUT });
    }
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#fafaf9" }}>
      <Img src={frameSrc("page-full")} style={{ position: "absolute", left: 0, top: -y * 1.5, width: "100%" }} />
    </AbsoluteFill>
  );
};

/** The popup, over the page where the browser shows it, from `from` until `to`. */
export const Popup: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(from * fps);
  const end = Math.round(to * fps);
  if (frame < start || frame > end + 4) return null;
  return (
    <Img
      src={frameSrc("popup")}
      style={{
        position: "absolute",
        left: POPUP.x,
        top: POPUP.y,
        width: POPUP.width,
        borderRadius: 12,
        border: "1px solid #d6d3d1",
        boxShadow: "0 18px 48px rgb(0 0 0 / 0.28)",
        opacity: interpolate(frame, [start, start + 5, end, end + 4], [0, 1, 1, 0], CLAMP),
        translate: interpolate(frame, [start, start + 6], ["0px -12px", "0px 0px"], { ...CLAMP, easing: EASE_OUT }),
      }}
    />
  );
};

export interface PointerStop {
  at: number;
  /** Where the pointer is, by name, in CSS pixels, or in the video's pixels (`screen`). */
  target: BoxName | Box | { screen: Box };
  click?: boolean;
}

function stopCenter(stop: PointerStop): { x: number; y: number } {
  const target = stop.target;
  if (typeof target === "object" && "screen" in target) return center(target.screen);
  return center(box(target));
}

/** A mouse pointer that glides between stops, with a ripple where it clicks, hidden after `hideAt`. */
export const Pointer: React.FC<{ stops: PointerStop[]; hideAt: number }> = ({ stops, hideAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const first = Math.round(stops[0].at * fps);
  const hide = Math.round(hideAt * fps);
  if (frame < first || frame > hide + 6) return null;
  let { x, y } = stopCenter(stops[0]);
  stops.forEach((stop, i) => {
    if (i === 0) return;
    const arrive = Math.round(stop.at * fps);
    const leave = arrive - Math.round(0.45 * fps);
    if (frame < leave) return;
    const a = stopCenter(stops[i - 1]);
    const b = stopCenter(stop);
    const t = interpolate(frame, [leave, arrive], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
    x = a.x + (b.x - a.x) * t;
    y = a.y + (b.y - a.y) * t;
  });
  const opacity = interpolate(frame, [first, first + 4, hide, hide + 6], [0, 1, 1, 0], CLAMP);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {stops
        .filter((stop) => stop.click === true)
        .map((stop, i) => {
          const at = Math.round(stop.at * fps);
          const c = stopCenter(stop);
          if (frame < at || frame > at + 14) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: c.x - 40,
                top: c.y - 40,
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: "5px solid #f97316",
                scale: interpolate(frame, [at, at + 14], [0.3, 1.2], { ...CLAMP, easing: EASE_OUT }),
                opacity: interpolate(frame, [at, at + 14], [0.9, 0], CLAMP),
              }}
            />
          );
        })}
      <svg
        width="42"
        height="60"
        viewBox="0 0 28 40"
        style={{ position: "absolute", left: x - 4, top: y - 2, opacity, filter: "drop-shadow(0 3px 5px rgb(0 0 0 / 0.35))" }}
      >
        <path d="M2 2 L2 32 L10 25 L15.5 37 L21 34.5 L15.5 23 L26 23 Z" fill="#111" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
};
