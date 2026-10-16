// Shared counter in D1: one row per UTC day.

import { MAX_BATCH, type Stats } from "../shared/stats";

const iso = (d: Date) => d.toISOString().slice(0, 10); // UTC day, e.g. 2026-10-15

let ready: Promise<unknown> | undefined; // creates the table once per worker instance
const setup = (db: D1Database) => (ready ??= db
  .prepare("CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)")
  .run()
  .catch(err => { ready = undefined; throw err; }));

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

/** Adds up to MAX_BATCH clicks and returns the fresh totals, in one round trip. */
export async function addClicks(db: D1Database, n: number): Promise<Stats> {
  await setup(db);
  const now = new Date();
  const [, res] = await db.batch<Stats>([
    db
      .prepare("INSERT INTO daily (day, n) VALUES (?1, ?2) ON CONFLICT(day) DO UPDATE SET n = daily.n + excluded.n")
      .bind(iso(now), Math.min(n, MAX_BATCH)),
    statsQuery(db, now),
  ]);
  return res.results[0];
}
