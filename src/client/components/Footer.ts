import { h, icon, pick } from "../lib/dom";

const MESSAGES = ["is this funny?", "discord wants this deleted.", "ping.", "touch grass instead.", "made by m5rcel btw", "uninstall complete. almost."];

/** Random one-liner on the left, credits button on the right. */
export function createFooter(onCredits: () => void) {
  const credits = h("button", { class: "text-button" }, "credits",
    icon('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'));
  credits.addEventListener("click", onCredits);
  return h("footer", {}, h("span", {}, pick(MESSAGES)), h("div", {}, credits));
}
