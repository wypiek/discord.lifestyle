import logoUrl from "../assets/logo.png";
import { h } from "../lib/dom";

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** Full-screen "the database needs a nap" page with a countdown to when counting resumes. */
export function createMaintenance(onCountdownEnd: () => void) {
  const time = h("span", { class: "maint-clock" });
  const fill = h("span");
  const percent = h("span");
  const countdown = h("div", {},
    time,
    h("span", { class: "maint-label" }, "until we're back"),
    h("div", { class: "maint-bar", "aria-hidden": "true" }, fill),
    h("span", { class: "maint-label" }, "recharging ", percent));
  const text = h("p", { class: "maint-text" });

  const el = h("div", { class: "maintenance", role: "status", hidden: true },
    h("div", { class: "maint-logo", "aria-hidden": "true" },
      h("img", { src: logoUrl, alt: "", draggable: "false" }),
      h("span", { class: "zzz" }, h("i", {}, "z"), h("i", {}, "z"), h("i", {}, "z"))),
    h("h2", { class: "maint-title" }, "the database needs a nap", h("span", { class: "period" }, ".")),
    text,
    countdown,
    h("p", { class: "maint-fine" }, "your clicks are saved and will sync when we're back."));

  let until: number | null = null, timer: ReturnType<typeof setInterval> | undefined;

  function tick(): void {
    if (until === null) return;
    const left = until - Date.now();
    time.textContent = clock(left);
    const done = Math.min(1, Math.max(0, 1 - left / DAY_MS)); // daily limits refill at midnight UTC
    fill.style.width = `${(done * 100).toFixed(1)}%`;
    percent.textContent = `${Math.floor(done * 100)}%`;
    if (left <= 0) { clearInterval(timer); timer = undefined; onCountdownEnd(); }
  }

  function show(end: number | null): void {
    if (!el.hidden && end === until) return;
    until = end;
    text.textContent = end === null
      ? "we're doing some maintenance. counting will be back soon."
      : "so many discords got deleted today that the database ran out of energy. it recharges at midnight UTC.";
    countdown.hidden = end === null;
    el.hidden = false;
    clearInterval(timer);
    timer = end === null ? undefined : setInterval(tick, 1000);
    tick();
  }

  function hide(): void {
    if (el.hidden) return;
    el.hidden = true;
    clearInterval(timer); timer = undefined;
  }

  return { el, show, hide };
}
