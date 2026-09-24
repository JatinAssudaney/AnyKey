import React from "react";
import { Framed } from "../components/Framed";
import { Camera, ScrollingPage } from "../components/Screen";

// j scrolls 60 CSS pixels at a time, d half the 720-pixel window, and g g goes back to the top.
export const ScrollScene: React.FC = () => (
  <Framed
    headline="Scroll with j and k"
    presses={[
      { at: 1.0, keys: "j" },
      { at: 1.4, keys: "j" },
      { at: 1.8, keys: "j" },
      { at: 2.6, keys: "d" },
      { at: 3.8, keys: "g g" },
    ]}
  >
    <Camera shots={[{ at: 0, zoom: 1 }]}>
      <ScrollingPage
        positions={[
          { at: 0, y: 0 },
          { at: 1.0, y: 60 },
          { at: 1.4, y: 120 },
          { at: 1.8, y: 180 },
          { at: 2.6, y: 540 },
          { at: 4.1, y: 0 },
        ]}
      />
    </Camera>
  </Framed>
);
