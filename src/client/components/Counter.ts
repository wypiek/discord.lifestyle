import type { Stats } from "../../shared/stats";
import logoUrl from "../assets/logo.png";
import { h } from "../lib/dom";

const fmt = new Intl.NumberFormat("en-US");
const PERIODS = [["today", "today"], ["week", "this week"], ["month", "this month"], ["year", "this year"]] as const;

/** Big shared total, the per-period totals under it, and the sync notice. */
export function createCounter() {
  const total = h("span", { id: "total", "aria-label": "Total deleted" }, "0");
  const periodValues = Object.fromEntries(PERIODS.map(([key]) => [key, h("b", {}, "0")])) as Record<(typeof PERIODS)[number][0], HTMLElement>;
  const notice = h("p", { id: "notice", role: "status" });

  const el = h("main", {},
    h("section", { class: "counter", "aria-label": "Deletion counter" },
      h("h1", {}, "delete discord", h("span", { class: "period" }, ".")),
      h("div", { class: "total-row" },
        total,
        h("div", { class: "hero-logo", title: "Discord logo" },
          h("img", { src: logoUrl, alt: "Discord", width: 80, height: 80, draggable: "false" }))),
      h("div", { class: "periods", "aria-label": "Deletion totals in UTC" },
        ...PERIODS.map(([key, label]) => h("span", {}, periodValues[key], ` ${label}`))),
      notice));

  /** Shrinks the total so long numbers stay on one line. */
  function fit(): void {
    const size = innerWidth <= 640 ? 86 : 128;
    total.style.fontSize = size + "px";
    const w = total.clientWidth;
    if (total.scrollWidth > w && w > 0) total.style.fontSize = Math.max(20, Math.floor(size * w / total.scrollWidth)) + "px";
  }

  function update(stats: Stats, message: string): void {
    total.textContent = fmt.format(stats.total);
    for (const [key] of PERIODS) periodValues[key].textContent = fmt.format(stats[key]);
    notice.textContent = message;
    document.title = fmt.format(stats.total) + " discords deleted.";
    fit();
  }

  function flash(): void {
    total.classList.remove("counter-flash");
    requestAnimationFrame(() => total.classList.add("counter-flash"));
  }

  return { el, update, fit, flash };
}
