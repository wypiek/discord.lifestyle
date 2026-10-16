// Counter shared by everyone, stored on the server (D1 behind /api/count).
// Clicks are counted locally right away and sent in batches; unsent clicks survive reloads.

import { MAX_BATCH, type Stats } from "../shared/stats";
import { load, save } from "./lib/storage";

const PENDING_KEY = "delete-discord-pending";
const POLL_MS = 2000; // how often to fetch everyone else's clicks
const FLUSH_MS = 250;
const RETRY_MS = 8000;
const OFFLINE_NOTICE = "can't reach the counter. your clicks will sync when it's back.";

export type SyncListener = (stats: Stats, notice: string) => void;

let base: Stats = { total: 0, today: 0, week: 0, month: 0, year: 0 }; // last numbers from the server
let pending = Math.max(0, parseInt(load(PENDING_KEY) ?? "", 10) || 0);
let inflight = 0, sending = false, epoch = 0, retryAt = 0, notice = "";
let listener: SyncListener = () => {};

const savePending = () => save(PENDING_KEY, String(pending));

const api = (method: "GET" | "POST", body?: { count: number }) => fetch("/api/count", {
  method, cache: "no-store", signal: AbortSignal.timeout(10000),
  headers: body ? { "content-type": "application/json" } : {},
  body: body ? JSON.stringify(body) : undefined,
});

/** Server totals plus clicks the server hasn't confirmed yet. */
function emit(): void {
  const add = pending + inflight;
  const shown = { ...base };
  for (const k of Object.keys(shown) as (keyof Stats)[]) shown[k] += add;
  listener(shown, notice);
}

async function flush(): Promise<void> { // send clicks the server hasn't seen yet
  if (sending || !pending || Date.now() < retryAt) return;
  const n = Math.min(pending, MAX_BATCH);
  pending -= n; inflight = n; sending = true; epoch++; savePending();
  try {
    const r = await api("POST", { count: n });
    if (!r.ok) throw new Error("bad status");
    base = await r.json(); inflight = 0; retryAt = 0; notice = "";
  } catch {
    pending += inflight; inflight = 0; savePending();
    retryAt = Date.now() + RETRY_MS;
    notice = OFFLINE_NOTICE;
  } finally { sending = false; epoch++; emit(); }
}

async function pull(): Promise<void> { // fetch the shared totals
  if (document.hidden || sending) return;
  const e = epoch;
  try {
    const r = await api("GET");
    if (!r.ok) throw new Error("bad status");
    const s: Stats = await r.json();
    if (e !== epoch || sending || s.total < base.total) return; // stale reply: ignore
    base = s; if (!retryAt) notice = ""; emit();
  } catch {}
}

/** Tab is closing: let the browser deliver the last clicks. */
function beacon(): void {
  if (!pending || sending || !navigator.sendBeacon) return;
  const n = Math.min(pending, MAX_BATCH);
  if (navigator.sendBeacon("/api/count", new Blob([JSON.stringify({ count: n })], { type: "application/json" }))) {
    pending -= n; savePending();
    for (const k of Object.keys(base) as (keyof Stats)[]) base[k] += n;
  }
}

export function addClick(): void {
  pending++; savePending(); emit(); flush();
}

export function startSync(onChange: SyncListener): void {
  listener = onChange;
  emit(); pull(); flush();
  setInterval(pull, POLL_MS); setInterval(flush, FLUSH_MS);
  addEventListener("online", () => { retryAt = 0; flush(); pull(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? beacon() : pull()));
}
