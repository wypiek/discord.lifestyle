// Invisible human check (Cloudflare Turnstile). Solved once, then the server hands back
// a session cookie that clicks ride on until it expires.

import { h } from "./lib/dom";
import { load, save } from "./lib/storage";

const SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SESSION_KEY = "delete-discord-human-until";
const MARGIN_MS = 60_000; // re-check a minute before the session runs out

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  execute(el: HTMLElement): void;
  reset(widgetId: string): void;
}
declare global {
  interface Window { turnstile?: Turnstile }
}

// Only visible if Turnstile decides it really needs a click from this visitor.
const box = h("div", { class: "turnstile" });
let script: Promise<Turnstile> | undefined;
let widget: string | undefined;
let waiting: { resolve(token: string): void; reject(err: Error): void } | undefined;
let checking: Promise<void> | undefined;

function loadTurnstile(): Promise<Turnstile> {
  return script ??= new Promise((resolve, reject) => {
    const s = h("script", { src: SCRIPT });
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => { script = undefined; s.remove(); reject(new Error("turnstile failed to load")); };
    document.head.append(s);
  });
}

async function getToken(): Promise<string> {
  const ts = await loadTurnstile();
  if (!box.isConnected) document.body.append(box);
  return new Promise((resolve, reject) => {
    waiting = { resolve, reject };
    if (widget === undefined) {
      widget = ts.render(box, {
        sitekey: SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token: string) => waiting?.resolve(token),
        "error-callback": () => { waiting?.reject(new Error("turnstile error")); return true; },
      });
    } else ts.reset(widget);
    ts.execute(box);
  });
}

/** Resolves once this browser holds a valid session. Safe to call often. */
export function ensureHuman(): Promise<void> {
  if (Number(load(SESSION_KEY)) > Date.now() + MARGIN_MS) return Promise.resolve();
  return checking ??= (async () => {
    const token = await getToken();
    const r = await fetch("/api/verify", {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!r.ok) throw new Error(`verify failed: ${r.status}`);
    const { expires } = await r.json() as { expires: number };
    save(SESSION_KEY, String(expires));
  })().finally(() => { checking = undefined; });
}

/** The server rejected the session; the next ensureHuman() runs a fresh check. */
export const forgetHuman = () => save(SESSION_KEY, "0");
