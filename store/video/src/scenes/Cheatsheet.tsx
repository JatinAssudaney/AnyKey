import React from "react";
import { Framed } from "../components/Framed";
import { Camera, Stills } from "../components/Screen";

// ? opens the cheatsheet, which lists the new shortcut with the built-in ones.
export const CheatsheetScene: React.FC = () => (
  <Framed headline="Press ? to see every shortcut" presses={[{ at: 0.9, keys: "?" }]}>
    <Camera shots={[{ at: 0, zoom: 1 }]}>
      <Stills
        steps={[
          { at: 0, still: "picker-used" },
          { at: 1.0, still: "cheatsheet" },
        ]}
      />
    </Camera>
  </Framed>
);
