import { preloadMusic, setMusic } from "../music";
import { createIconToggle } from "./IconToggle";

const SPEAKER = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
  + '<g class="waves"><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></g>'
  + '<g class="x"><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></g>';

export function createMusicToggle() {
  const el = createIconToggle({
    className: "music-toggle",
    iconBody: SPEAKER,
    labels: ["Unmute music", "Mute music"],
    pressed: false,
    onToggle: setMusic,
  });
  // Start decoding the track as soon as the visitor heads for the button.
  for (const ev of ["pointerenter", "focus", "touchstart"]) el.addEventListener(ev, preloadMusic, { once: true, passive: true });
  return el;
}
