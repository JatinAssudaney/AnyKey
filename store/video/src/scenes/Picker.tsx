import React from "react";
import { Framed } from "../components/Framed";
import { Camera, Pointer, Popup, Stills } from "../components/Screen";
import { POPUP_ADD } from "../lib/frames";

// Alt+Shift+K opens the popup, "Add shortcut for this site" starts the picker, the pointer picks Save, g then s and
// Enter save the shortcut, Esc closes the picker, and g then s clicks Save.
export const PickerScene: React.FC = () => (
  <Framed
    headline="Give any button its own key"
    presses={[
      { at: 0.8, keys: "Alt+Shift+K" },
      { at: 6.2, keys: "g s" },
      { at: 7.8, keys: "Enter" },
      { at: 9.0, keys: "Esc" },
      { at: 10.9, keys: "g s" },
    ]}
  >
    <Camera
      shots={[
        { at: 0, zoom: 1 },
        { at: 5.3, zoom: 1.45, target: "panel" },
        { at: 8.9, zoom: 1 },
        { at: 10.3, zoom: 1.8, target: "save" },
      ]}
    >
      <Stills
        steps={[
          { at: 0, still: "page" },
          { at: 3.3, still: "picker-start" },
          { at: 4.4, still: "picker-hover" },
          { at: 5.3, still: "picker-panel" },
          { at: 6.55, still: "picker-keys" },
          { at: 7.9, still: "picker-saved" },
          { at: 9.1, still: "picker-toast" },
          { at: 11.3, still: "picker-used" },
        ]}
      />
      <Popup from={1.0} to={2.8} />
      <Pointer
        stops={[
          { at: 1.8, target: { screen: POPUP_ADD } },
          { at: 2.5, target: { screen: POPUP_ADD }, click: true },
          { at: 3.3, target: "print" },
          { at: 4.4, target: "save" },
          { at: 5.1, target: "save", click: true },
        ]}
        hideAt={5.6}
      />
    </Camera>
  </Framed>
);
