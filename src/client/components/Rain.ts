import logoUrl from "../assets/logo.png";
import { h } from "../lib/dom";
import { reducedMotion } from "../lib/motion";

interface Drop {
  el: HTMLButtonElement;
  lane: number; // 0..1 across the width
  x: number;
  y: number;
  speed: number; // px per second
  angle: number;
  spin: number; // degrees per second
}

const HIDE_MS = 1200; // reduced motion: a hit logo disappears this long instead of respawning

/** Falling Discord logos. `onHit` gets the screen center of the logo that was clicked. */
export function createRain(onHit: (x: number, y: number) => void) {
  const el = h("div", { id: "rain", "aria-label": "Falling Discord logos" });
  const drops: Drop[] = [];

  function place(d: Drop): void {
    const size = el.clientWidth < 640 ? 54 : 62;
    d.x = d.lane * Math.max(0, el.clientWidth - size);
    d.el.style.transform = `translate3d(${d.x}px,${d.y}px,0) rotate(${d.angle}deg)`;
  }

  function respawn(d: Drop): void {
    d.lane = Math.random();
    d.y = -80 - Math.random() * 160;
    d.speed = (el.clientHeight + 120) / (5 + Math.random() * 4);
    d.spin = Math.random() * 18 - 9;
  }

  /** (Re)creates the logos for the current screen size. Needs `el` in the document. */
  function build(): void {
    el.replaceChildren(); drops.length = 0;
    const n = innerWidth < 640 ? 12 : 15;
    for (let i = 0; i < n; i++) {
      const b = h("button", { class: "drop", tabindex: -1, "aria-label": "Delete falling Discord" },
        h("img", { src: logoUrl, alt: "", draggable: "false" }));
      el.append(b);
      const d: Drop = {
        el: b, lane: Math.random(), x: 0, y: el.clientHeight * ((i + Math.random()) / n),
        speed: (el.clientHeight + 120) / (5 + Math.random() * 2), angle: Math.random() * 42 - 21, spin: Math.random() * 9 - 4.5,
      };
      drops.push(d); place(d);
      b.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const r = b.getBoundingClientRect();
        onHit(r.x + r.width / 2, r.y + r.height / 2);
        if (reducedMotion()) { b.hidden = true; setTimeout(() => { b.hidden = false; }, HIDE_MS); }
        else { respawn(d); place(d); }
      });
    }
  }

  let last = performance.now();
  function tick(t: number): void {
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    if (!reducedMotion() && !document.hidden) {
      for (const d of drops) {
        d.y += d.speed * dt; d.angle += d.spin * dt;
        if (d.y > el.clientHeight + 80) respawn(d);
        place(d);
      }
    }
    requestAnimationFrame(tick);
  }

  function start(): void {
    build();
    requestAnimationFrame(tick);
  }

  return { el, start, build };
}
