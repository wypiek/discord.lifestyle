// Run with `npm test` (Node runs the TypeScript directly).
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { addClicks, CLICK_BURST, CLICK_RATE, getStats } from "../src/worker/counter.ts";
import { newSession, sessionId } from "../src/worker/human.ts";
import { createLimiter, ipKey } from "../src/worker/limiter.ts";
import { maintenance, noteDbError } from "../src/worker/maintenance.ts";

const env = { SESSION_SECRET: "test-secret" } as any;
const withCookie = (cookie: string) => new Request("https://x/api/count", { headers: { cookie } });

test("session cookie round-trips and rejects tampering, other secrets and expiry", async t => {
  const { cookie } = await newSession(env);
  const value = cookie.split(";")[0];
  assert.ok(await sessionId(env, withCookie(value)));
  const [exp, id, sig] = value.split(".");
  assert.equal(await sessionId(env, withCookie(`${exp}.${id.replace(/^./, c => (c === "a" ? "b" : "a"))}.${sig}`)), null);
  assert.equal(await sessionId(env, withCookie(`${Number(exp) + 1}.${id}.${sig}`)), null);
  assert.equal(await sessionId({ ...env, SESSION_SECRET: "other" }, withCookie(value)), null);
  assert.equal(await sessionId({ ...env, SESSION_SECRET: undefined }, withCookie(value)), null);
  t.mock.method(Date, "now", () => Date.UTC(2100, 0, 1));
  assert.equal(await sessionId(env, withCookie(value)), null);
});

test("maintenance turns on when D1 hits its daily limit, until 00:00 UTC", t => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 16, 12) });
  assert.equal(maintenance(env), null);
  assert.equal(noteDbError(new Error("D1_ERROR: D1 DB exceeded its CPU time limit and was reset.")), false);
  assert.equal(maintenance(env), null, "other D1 errors don't count");

  assert.equal(noteDbError(new Error("D1_ERROR: Your account has exceeded D1's free tier daily row write limit.")), true);
  assert.deepEqual(maintenance(env), { until: Date.UTC(2026, 9, 17) });
  assert.equal(maintenance({ ...env, MAINTENANCE: "off" }), null);
  t.mock.timers.tick(12 * 60 * 60_000);
  assert.equal(maintenance(env), null, "limits reset at midnight");

  assert.ok(noteDbError("Your account has exceeded D1's free tier daily row read limit."));
  assert.deepEqual(maintenance(env), { until: Date.UTC(2026, 9, 18) });
  assert.deepEqual(maintenance({ ...env, MAINTENANCE: "on" }), { until: null });
});

test("limiter allows `limit` hits per window per key, then resets", t => {
  let now = 0;
  t.mock.method(Date, "now", () => now);
  const ok = createLimiter(3, 10_000);
  assert.deepEqual([ok("a"), ok("a"), ok("a"), ok("a")], [true, true, true, false]);
  assert.equal(ok("b"), true, "keys are independent");
  now = 10_000;
  assert.equal(ok("a"), true, "new window");
});

test("ipKey groups IPv6 by /64 and leaves IPv4 alone", () => {
  assert.equal(ipKey("203.0.113.7"), "203.0.113.7");
  assert.equal(ipKey("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(ipKey("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"), "2001:db8:1:2::/64");
  assert.equal(ipKey("2001:db8::5"), "2001:db8:0:0::/64");
  assert.equal(ipKey("::1"), "0:0:0:0::/64");
});

// Just enough of D1 to run the real SQL on Node's SQLite.
function fakeD1(): D1Database {
  const sql = new DatabaseSync(":memory:");
  const stmt = (query: string, args: unknown[] = []): any => ({
    bind: (...a: unknown[]) => stmt(query, a),
    all: () => ({ results: sql.prepare(query).all(...(args as any[])) }),
    run() { return this.all(); },
    first() { return this.all().results[0] ?? null; },
  });
  return {
    prepare: (query: string) => stmt(query),
    batch: async (list: any[]) => {
      sql.exec("BEGIN");
      try { const out = list.map(s => s.all()); sql.exec("COMMIT"); return out; }
      catch (err) { sql.exec("ROLLBACK"); throw err; }
    },
  } as any;
}

test("click budget caps a session at CLICK_RATE per second after a CLICK_BURST", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 16, 12) });
  const wait = (ms: number) => t.mock.timers.tick(ms);
  const db = fakeD1();

  // A script spamming full batches: the first burst gets through, then nothing.
  let counted = 0;
  for (let i = 0; i < 10; i++) counted += (await addClicks(db, "bot", 50)).accepted;
  assert.equal(counted, CLICK_BURST);
  assert.equal((await addClicks(db, "bot", 50)).accepted, 0);

  wait(1000); // one second refills CLICK_RATE
  assert.equal((await addClicks(db, "bot", 50)).accepted, CLICK_RATE);
  wait(60_000); // never saves up more than the burst
  assert.equal((await addClicks(db, "bot", 500)).accepted, CLICK_BURST);

  // Sessions are independent, and the totals only include accepted clicks.
  const human = await addClicks(db, "human", 7);
  assert.equal(human.accepted, 7);
  assert.equal(human.stats.total, CLICK_BURST + CLICK_RATE + CLICK_BURST + 7);
  assert.equal((await getStats(db))?.today, human.stats.total);

  // A human clicking 10 times a second, batched every 500 ms, never loses a click.
  for (let i = 0; i < 100; i++) { wait(500); assert.equal((await addClicks(db, "human", 5)).accepted, 5); }
});
