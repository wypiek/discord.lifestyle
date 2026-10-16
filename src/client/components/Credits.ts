import { h, icon } from "../lib/dom";

type Link = [text: string, href: string];

const CREDITS: [term: string, ...parts: (Link | string)[]][] = [
  ["Creator", ["m5rcel", "https://twitter.com/m5rcode"]],
  ["Inspired by", ["yash's awesome vencord.org site", "https://vencord.org"]],
  ["Logo", ["Discord", "https://discord.com/branding"]],
  ["Explosion", ["Pixel explosion by JROB774", "https://opengameart.org/content/pixel-explosion-12-frames"], " · ",
    ["CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"], ". Scaled for display."],
  ["Sound", ["Roblox Explosion Sound / Myinstants", "https://www.myinstants.com/en/instant/roblox-explosion-sound-48524/"]],
  ["Music", ["Discord Call Trap Remix by Leonz", "https://www.youtube.com/watch?v=Na6r5_XPOtk"]],
  ["Type", "Outfit by Outfit, SIL Open Font License."],
];

const part = (p: Link | string) =>
  typeof p === "string" ? p : h("a", { href: p[1], target: "_blank", rel: "noreferrer" }, p[0]);

/** Modal with attributions. Closes on the X or a click on the backdrop. */
export function createCredits() {
  const close = h("button", { class: "icon-button", "aria-label": "Close credits", title: "Close credits" },
    icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'));

  const el = h("dialog", {},
    h("div", { class: "dialog-heading" }, h("h2", {}, "credits"), close),
    h("p", {}, "This site is unaffiliated with Discord."),
    h("dl", {}, ...CREDITS.flatMap(([term, ...parts]) => [h("dt", {}, term), h("dd", {}, ...parts.map(part))])),
    h("p", { class: "fine-print" }, "nothing personal towards discord but i was bored when i was making this lol."));

  close.addEventListener("click", () => el.close());
  el.addEventListener("click", e => {
    if (e.target !== el) return;
    const r = el.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) el.close();
  });

  return { el, open: () => el.showModal() };
}
