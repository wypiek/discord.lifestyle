import { setSfx, sfxEnabled } from "../sfx";
import { createIconToggle } from "./IconToggle";

const BURST = '<polygon points="22,12 16.62,13.91 19.07,19.07 13.91,16.62 12,22 10.09,16.62 4.93,19.07 7.38,13.91 2,12 7.38,10.09 4.93,4.93 10.09,7.38 12,2 13.91,7.38 19.07,4.93 16.62,10.09"/>'
  + '<line class="slash" x1="3" y1="3" x2="21" y2="21"/>';

export function createSfxToggle() {
  return createIconToggle({
    className: "sfx-toggle",
    iconBody: BURST,
    labels: ["Unmute explosion sound", "Mute explosion sound"],
    pressed: sfxEnabled(),
    onToggle: setSfx,
  });
}
