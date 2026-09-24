import React, { Fragment } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { EndCard, TitleCard } from "./scenes/Cards";
import { CheatsheetScene } from "./scenes/Cheatsheet";
import { HintsScene } from "./scenes/Hints";
import { PickerScene } from "./scenes/Picker";
import { ScrollScene } from "./scenes/Scroll";
import { SettingsScene } from "./scenes/Settings";

// AnyKey's demo video, about 40 seconds: the scenes in turn, each fading into the next.

/** Each scene and its length in frames, at 30 per second. */
export const SCENES: { name: string; frames: number; Scene: React.FC }[] = [
  { name: "Title", frames: 105, Scene: TitleCard },
  { name: "Scroll", frames: 165, Scene: ScrollScene },
  { name: "Hints", frames: 225, Scene: HintsScene },
  { name: "Picker", frames: 390, Scene: PickerScene },
  { name: "Cheatsheet", frames: 135, Scene: CheatsheetScene },
  { name: "Settings", frames: 150, Scene: SettingsScene },
  { name: "End", frames: 120, Scene: EndCard },
];

const FADE = 12;

/** The fades overlap the scenes on either side, so each one shortens the video. */
export const DEMO_DURATION = SCENES.reduce((total, scene) => total + scene.frames, 0) - (SCENES.length - 1) * FADE;

export const Demo: React.FC = () => (
  <TransitionSeries>
    {SCENES.map(({ name, frames, Scene }, i) => (
      <Fragment key={name}>
        {i > 0 && <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />}
        <TransitionSeries.Sequence name={name} durationInFrames={frames}>
          <Scene />
        </TransitionSeries.Sequence>
      </Fragment>
    ))}
  </TransitionSeries>
);
