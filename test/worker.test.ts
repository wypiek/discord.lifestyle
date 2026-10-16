// Run with `npm test` (Node runs the TypeScript directly).
import assert from "node:assert/strict";
import { test } from "node:test";
import { newSession, sessionId } from "../src/worker/human.ts";
import { maintenance } from "../src/worker/maintenance.ts";

const env = { SESSION_SECRET: "test-secret", CF_API_TOKEN: "t", CF_ACCOUNT_ID: "a" } as any;
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

test("maintenance follows D1 usage, the manual switch, and keeps the last answer on API errors", async t => {
  let now = Date.UTC(2026, 9, 16, 12);
  t.mock.method(Date, "now", () => now);
  let reply: unknown = null;
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    reply instanceof Error ? Promise.reject(reply) : new Response(JSON.stringify(reply)));
  const usage = (rowsRead: number, rowsWritten: number) =>
    ({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead, rowsWritten } }] }] } } });
  const next = (r: unknown) => { reply = r; now += 61_000; }; // past the per-minute cache

  next(usage(1_000_000, 10_000));
  assert.equal(await maintenance(env), null);
  next(usage(4_600_000, 0)); // 92% of 5M reads
  assert.deepEqual(await maintenance(env), { until: Date.UTC(2026, 9, 17) });
  next(usage(0, 95_000)); // 95% of 100K writes
  assert.ok(await maintenance(env));
  next(new Error("network down"));
  assert.ok(await maintenance(env), "API failure keeps the last reading");
  next({ errors: [{ message: "bad token" }] });
  assert.ok(await maintenance(env));
  next(usage(10, 10));
  assert.equal(await maintenance(env), null);
  next(usage(4_600_000, 0));
  assert.equal(await maintenance({ ...env, DB_DAILY_READ_LIMIT: "25000000000" }), null, "paid-plan limit");

  const calls = fetchMock.mock.callCount();
  assert.equal(await maintenance(env), null, "cached within the minute");
  assert.equal(fetchMock.mock.callCount(), calls);

  assert.deepEqual(await maintenance({ ...env, MAINTENANCE: "on" }), { until: null });
  assert.equal(await maintenance({ ...env, MAINTENANCE: "off" }), null);
  assert.equal(await maintenance({ ...env, CF_API_TOKEN: undefined }), null);
});
