// Maintenance mode: switches on by itself when today's D1 usage nears the plan's daily
// limit, so visitors see a maintenance page instead of errors. Limits reset at 00:00 UTC.

import type { Env } from "./env";

const THRESHOLD = 0.9; // fraction of a daily limit that triggers maintenance
const CHECK_MS = 60_000; // how long one usage reading is trusted
const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
// Account-wide, because the free plan's limits apply to all databases together.
const QUERY = `query ($account: String!, $day: Date!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $day, date_leq: $day }) {
        sum { rowsRead rowsWritten }
      }
    }
  }
}`;

interface UsageReply {
  data?: { viewer: { accounts: { d1AnalyticsAdaptiveGroups: { sum: { rowsRead: number; rowsWritten: number } }[] }[] } };
  errors?: { message: string }[] | null;
}

export interface Maintenance {
  /** When it should end (epoch ms), or null if unknown. */
  until: number | null;
}

// ponytail: cached per worker instance, so each instance asks the API at most once a minute.
let reading: { at: number; near: Promise<boolean> } | undefined;
let lastNear = false;

async function readUsage(env: Env): Promise<boolean> {
  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { account: env.CF_ACCOUNT_ID, day: new Date().toISOString().slice(0, 10) } }),
    });
    const body = await res.json<UsageReply>();
    if (!res.ok || body.errors?.length || !body.data) throw new Error(body.errors?.[0]?.message ?? `HTTP ${res.status}`);
    let reads = 0, writes = 0;
    for (const g of body.data.viewer.accounts[0]?.d1AnalyticsAdaptiveGroups ?? []) {
      reads += g.sum.rowsRead; writes += g.sum.rowsWritten;
    }
    const near = reads >= THRESHOLD * Number(env.DB_DAILY_READ_LIMIT ?? 5_000_000)
      || writes >= THRESHOLD * Number(env.DB_DAILY_WRITE_LIMIT ?? 100_000);
    return (lastNear = near);
  } catch (err) {
    console.error("D1 usage check failed:", err);
    return lastNear; // keep the last answer while the API is unreachable
  }
}

function nextUtcMidnight(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Non-null while the site should show the maintenance page. */
export async function maintenance(env: Env): Promise<Maintenance | null> {
  if (env.MAINTENANCE === "on") return { until: null };
  if (env.MAINTENANCE === "off" || !env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return null;
  if (!reading || Date.now() - reading.at > CHECK_MS) reading = { at: Date.now(), near: readUsage(env) };
  return (await reading.near) ? { until: nextUtcMidnight() } : null;
}
