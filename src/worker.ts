// Cloudflare worker for "delete discord."
// Shared counter in a D1 database bound as DB.
// Every request that isn't /api/count is served as a normal static file.

import { MAX_BATCH, type Stats } from "./shared/stats";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/count") return env.ASSETS.fetch(request);
    if (!env.DB) return json({ error: "D1 binding named DB is missing" }, 500);
    const db = env.DB;

    try {
      await setup(db);

      if (request.method === "GET") return json(await statsQuery(db, new Date()).first<Stats>());

      if (request.method === "POST") {
        const origin = request.headers.get("origin");
        if (origin) {
          let same = false;
          try { same = new URL(origin).host === url.host; } catch {}
          if (!same) return json({ error: "forbidden" }, 403);
        }
        const body = await request.json<{ count?: unknown }>().catch(() => null);
        const n = Math.floor(Number(body?.count));
        if (!Number.isFinite(n) || n < 1) return json({ error: "bad count" }, 400);

        const now = new Date();
        // One round trip: add the clicks, then read the fresh totals in the same batch.
        const [, res] = await db.batch<Stats>([
          db
            .prepare("INSERT INTO daily (day, n) VALUES (?1, ?2) ON CONFLICT(day) DO UPDATE SET n = daily.n + excluded.n")
            .bind(iso(now), Math.min(n, MAX_BATCH)),
          statsQuery(db, now),
        ]);
        return json(res.results[0]);
      }

      return json({ error: "method not allowed" }, 405);
    } catch {
      return json({ error: "server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
