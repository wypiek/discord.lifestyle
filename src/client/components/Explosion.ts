import { h, pick } from "../lib/dom";

const WORDS = ["poof.", "bonk.", "uninstalled.", "bye."];
const MAX_LIVE = 16; // skip the effect when this many are already on screen
const HALF = 72; // half the sprite's 144px frame

/** Sprite explosion plus a floating word, centered on (x, y). Removes itself when done. */
export function explode(x: number, y: number): void {
  if (document.querySelectorAll(".explosion").length >= MAX_LIVE) return;

  const boom = h("div", { class: "explosion" });
  boom.style.left = (x - HALF) + "px"; boom.style.top = (y - HALF) + "px";
  boom.addEventListener("animationend", () => boom.remove(), { once: true });

  const label = h("span", { class: "pop-label" }, pick(WORDS));
  label.style.left = Math.min(innerWidth - 92, Math.max(8, x - 20)) + "px";
  label.style.top = (y - 35) + "px";
  setTimeout(() => label.remove(), 900);

  document.body.append(boom, label);
}
