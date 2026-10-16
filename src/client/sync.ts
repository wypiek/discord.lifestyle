// Counter shared by everyone, stored on the server (D1 behind /api/count).
// Clicks are counted locally right away and sent in batches; unsent clicks survive reloads.

import { MAX_BATCH, type Stats } from "../shared/stats";
import { ensureHuman, forgetHuman } from "./human";
import { load, save } from "./lib/storage";

const PENDING_KEY = "delete-discord-pending";
// How often to fetch everyone else's clicks. Each fetch is a Pages Functions request
// (100K/day on the free plan), so poll fast only while the count is moving.
const FAST_POLL_MS = 1000;
const IDLE_POLL_MS = 2000; // same as before, so nothing is slower than it was
const ACTIVE_FOR_MS = 20_000; // "moving" = changed or clicked within this long
const MAINTENANCE_POLL_MS = 30_000; // slower while the site is down for maintenance
const FLUSH_MS = 500; // 2 batches/s, under the server's 20 per 10 s click limit
const RETRY_MS = 8000;
const RATE_LIMIT_MS = 10_000;
const OFFLINE_NOTICE = "can't reach the counter. your clicks will sync when it's back.";
const SLOW_NOTICE = "whoa, slow down. your clicks will sync in a moment.";
const HUMAN_NOTICE = "couldn't check that you're human. retrying soon.";

export interface SyncState {
  stats: Stats;
  notice: string;
  /** Non-null while the server is in maintenance; `until` is epoch ms or null if unknown. */
  maintenance: { until: number | null } | null;
}
export type SyncListener = (state: SyncState) => void;

let base: Stats = { total: 0, today: 0, week: 0, month: 0, year: 0 }; // last numbers from the server
let pending = Math.max(0, parseInt(load(PENDING_KEY) ?? "", 10) || 0);
let inflight = 0, sending = false, epoch = 0, retryAt = 0, notice = "", lastChange = 0;
let maintenance: SyncState["maintenance"] = null;
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
  const stats = { ...base };
  for (const k of Object.keys(stats) as (keyof Stats)[]) stats[k] += add;
  listener({ stats, notice, maintenance });
}

/** Reads a 503 maintenance reply. Returns false for any other response. */
async function checkMaintenance(r: Response): Promise<boolean> {
  if (r.status !== 503) return false;
  const body = await r.json().catch(() => null) as { error?: string; until?: number | null } | null;
  if (body?.error !== "maintenance") return false;
  maintenance = { until: body.until ?? null };
  return true;
}

async function flush(): Promise<void> { // send clicks the server hasn't seen yet
  if (sending || !pending || maintenance || Date.now() < retryAt) return;
  const n = Math.min(pending, MAX_BATCH);
  pending -= n; inflight = n; sending = true; epoch++; savePending();
  try {
    const r = await api("POST", { count: n });
    if (r.ok) {
      // The server counts at most the session's click budget; the rest go back in the queue.
      const { accepted = n, ...stats } = await r.json() as Stats & { accepted?: number };
      const counted = Math.max(0, Math.min(n, accepted));
      base = stats; pending += n - counted; inflight = 0; savePending();
      retryAt = 0; notice = counted < n ? SLOW_NOTICE : "";
      return;
    }

    pending += inflight; inflight = 0; savePending(); // not counted: keep them for later
    if (await checkMaintenance(r)) return;
    if (r.status === 429) { retryAt = Date.now() + RATE_LIMIT_MS; notice = SLOW_NOTICE; return; }
    if (r.status === 401) {
      forgetHuman();
      try { await ensureHuman(); } catch { retryAt = Date.now() + RETRY_MS; notice = HUMAN_NOTICE; }
      return; // next flush sends with the new session
    }
    throw new Error("bad status");
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
    if (await checkMaintenance(r)) { emit(); return; }
    if (!r.ok) throw new Error("bad status");
    const s: Stats = await r.json();
    maintenance = null;
    if (e !== epoch || sending || s.total < base.total) { emit(); return; } // stale reply: ignore the numbers
    if (s.total !== base.total) lastChange = Date.now();
    base = s; if (!retryAt) notice = ""; emit();
  } catch {}
}

/** Tab is closing: let the browser deliver the last clicks. */
function beacon(): void {
  if (!pending || sending || maintenance || !navigator.sendBeacon) return;
  const n = Math.min(pending, MAX_BATCH);
  if (navigator.sendBeacon("/api/count", new Blob([JSON.stringify({ count: n })], { type: "application/json" }))) {
    pending -= n; savePending();
    for (const k of Object.keys(base) as (keyof Stats)[]) base[k] += n;
  }
}

export function addClick(): void {
  lastChange = Date.now();
  pending++; savePending(); emit(); flush();
}

/** Fetch now instead of waiting for the next poll (e.g. when a maintenance countdown ends). */
export const refresh = () => { pull(); };

function pollLoop(): void {
  const delay = maintenance ? MAINTENANCE_POLL_MS
    : Date.now() - lastChange < ACTIVE_FOR_MS ? FAST_POLL_MS : IDLE_POLL_MS;
  setTimeout(() => pull().finally(pollLoop), delay);
}

export function startSync(onChange: SyncListener): void {
  listener = onChange;
  emit(); pull();
  ensureHuman().then(flush, () => {}); // check in the background so the first click isn't delayed
  pollLoop(); setInterval(flush, FLUSH_MS);
  addEventListener("online", () => { retryAt = 0; flush(); refresh(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? beacon() : refresh()));
}
