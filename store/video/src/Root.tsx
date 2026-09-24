import React from "react";
import { Composition, Folder } from "remotion";
import { Demo, DEMO_DURATION, SCENES } from "./Demo";

// AnyKey's demo video for the Chrome Web Store listing, and each of its scenes on its own for working on one.
// Watch it in the Studio (npm run dev), and render it with `npx remotion render Demo out/anykey-demo.mp4`.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={DEMO_DURATION} fps={30} width={1920} height={1080} />
    <Folder name="Scenes">
      {SCENES.map(({ name, frames, Scene }) => (
        <Composition key={name} id={name} component={Scene} durationInFrames={frames} fps={30} width={1920} height={1080} />
      ))}
    </Folder>
  </>
);
