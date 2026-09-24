import React from "react";
import { Framed } from "../components/Framed";
import { Camera, Stills } from "../components/Screen";
import { HINT_LABEL } from "../lib/frames";

/** The recipe list in the sidebar, in CSS pixels, where the camera looks while a label is typed. */
const SIDEBAR = { x: 820, y: 120, width: 460, height: 330 };

// F labels every link and button, typing a label narrows them, and its last letter follows the link.
export const HintsScene: React.FC = () => {
  const [first, second] = HINT_LABEL.split("");
  return (
    <Framed
      headline="Press F to click anything"
      presses={[
        { at: 1.0, keys: "Shift+F" },
        { at: 3.4, keys: first },
        { at: 4.6, keys: second },
      ]}
    >
      <Camera
        shots={[
          { at: 0, zoom: 1 },
          { at: 2.5, zoom: 1.7, target: SIDEBAR },
          { at: 4.9, zoom: 1 },
        ]}
      >
        <Stills
          steps={[
            { at: 0, still: "page" },
            { at: 1.1, still: "hints-all" },
            { at: 3.5, still: "hints-typed" },
            { at: 4.7, still: "hints-picked" },
          ]}
        />
      </Camera>
    </Framed>
  );
};
