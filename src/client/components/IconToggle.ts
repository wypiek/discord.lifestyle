import { h, icon } from "../lib/dom";

interface IconToggleOptions {
  className: string;
  /** Inner SVG markup; CSS shows/hides parts of it based on aria-pressed. */
  iconBody: string;
  /** Labels for [off, on]; each describes what a click will do. */
  labels: readonly [string, string];
  pressed: boolean;
  onToggle: (pressed: boolean) => void;
}

/** Corner icon button with a pressed state and matching accessible label. */
export function createIconToggle({ className, iconBody, labels, pressed, onToggle }: IconToggleOptions) {
  const el = h("button", { class: `icon-button ${className}` }, icon(iconBody));

  const paint = () => {
    const label = labels[pressed ? 1 : 0];
    el.setAttribute("aria-pressed", String(pressed));
    el.setAttribute("aria-label", label);
    el.title = label;
  };

  el.addEventListener("click", () => { pressed = !pressed; paint(); onToggle(pressed); });
  paint();
  return el;
}
