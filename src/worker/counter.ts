// Shared counter in D1: one row per UTC day, plus a click budget per human-check session.

import type { Stats } from "../shared/stats";

/** Clicks per second a session earns back, and the most it can save up. Faster than a
 *  human can click, but caps a script replaying the API to the same pace. */
export const CLICK_RATE = 20;
export const CLICK_BURST = 100;
const BUDGET_TTL_S = 60 * 60; // a budget row is useless once its session (1 h) has expired
const PRUNE_MS = 10 * 60_000;

const iso = (d: Date) => d.toISOString().slice(0, 10); // UTC day, e.g. 2026-10-15

let ready: Promise<unknown> | undefined; // creates the tables once per worker instance
const setup = (db: D1Database) => (ready ??= db
  .batch([
    db.prepare("CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)"),
    // Token bucket per session. Lives in D1 rather than memory so the limit holds across
    // worker instances. `granted` is the last request's share, read by the daily insert.
    db.prepare(`CREATE TABLE IF NOT EXISTS budget (
      id TEXT PRIMARY KEY, tokens REAL NOT NULL, at REAL NOT NULL, granted INTEGER NOT NULL)`),
  ])
  .catch(err => { ready = undefined; throw err; }));

let lastPrune = 0; // per worker instance

// Prepared (not yet run) statement, so it can be sent alone or batched with a write.
function statsQuery(db: D1Database, now: Date): D1PreparedStatement {
  const today = iso(now);
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7)); // weeks begin Monday
  return db.prepare(
    `SELECT COALESCE(SUM(n), 0) AS total,
            COALESCE(SUM(CASE WHEN day = ?1 THEN n END), 0) AS today,
            COALESCE(SUM(CASE WHEN day >= ?2 THEN n END), 0) AS week,
            COALESCE(SUM(CASE WHEN day >= ?3 THEN n END), 0) AS month,
            COALESCE(SUM(CASE WHEN day >= ?4 THEN n END), 0) AS year
     FROM daily`
  ).bind(today, iso(mon), today.slice(0, 7) + "-01", today.slice(0, 4) + "-01-01");
}

export async function getStats(db: D1Database): Promise<Stats | null> {
  await setup(db);
  return statsQuery(db, new Date()).first<Stats>();
}

/** Spends up to `n` clicks from the session's budget, adds what it allowed, and returns
 *  the fresh totals and how many clicks were counted, in one round trip. */
export async function addClicks(db: D1Database, session: string, n: number): Promise<{ stats: Stats; accepted: number }> {
  await setup(db);
  const now = new Date();
  const t = now.getTime() / 1000;
  // A new session starts with a full budget. In SET, `tokens` and `at` are the old values.
  const refilled = `min(?3, tokens + max(0, ?4 - at) * ?5)`;
  const spend = db.prepare(
    `INSERT INTO budget (id, tokens, at, granted) VALUES (?1, ?3 - min(?2, ?3), ?4, min(?2, ?3))
     ON CONFLICT(id) DO UPDATE SET
       granted = min(?2, CAST(${refilled} AS INTEGER)),
       tokens = ${refilled} - min(?2, CAST(${refilled} AS INTEGER)),
       at = ?4
     RETURNING granted`
  ).bind(session, n, CLICK_BURST, t, CLICK_RATE);
  const count = db.prepare(
    `INSERT INTO daily (day, n) SELECT ?1, granted FROM budget WHERE id = ?2 AND granted > 0
     ON CONFLICT(day) DO UPDATE SET n = daily.n + excluded.n`
  ).bind(iso(now), session);

  const statements = [spend, count, statsQuery(db, now)];
  if (Date.now() - lastPrune > PRUNE_MS) {
    lastPrune = Date.now();
    statements.push(db.prepare("DELETE FROM budget WHERE at < ?1").bind(t - BUDGET_TTL_S));
  }
  const [spent, , totals] = await db.batch(statements);
  return {
    stats: totals.results[0] as Stats,
    accepted: (spent.results[0] as { granted: number } | undefined)?.granted ?? 0,
  };
}
