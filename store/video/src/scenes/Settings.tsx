import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Framed } from "../components/Framed";
import { frameSrc } from "../lib/frames";
import { CLAMP } from "../lib/theme";

// The settings for a site with a preset, drifting slowly closer.
export const SettingsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <Framed headline="Presets for GitHub, YouTube and Reddit" presses={[]}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={frameSrc("settings")}
          style={{
            width: "100%",
            height: "100%",
            transformOrigin: "50% 30%",
            scale: interpolate(frame, [0, durationInFrames], [1, 1.07], CLAMP),
          }}
        />
      </AbsoluteFill>
    </Framed>
  );
};
