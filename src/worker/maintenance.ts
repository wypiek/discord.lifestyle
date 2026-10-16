// Maintenance mode: switches on by itself once D1 refuses queries because the plan's daily
// row read or write limit is used up, so visitors see a maintenance page instead of
// errors. Limits reset at 00:00 UTC. Needs no account secrets: D1's own error says so.

import type { Env } from "./env";

// D1 says e.g. "Your account has exceeded D1's free tier daily row read limit."
const DAILY_LIMIT = /daily row (read|write) limit/i;

export interface Maintenance {
  /** When it should end (epoch ms), or null if unknown. */
  until: number | null;
}

// ponytail: per worker instance; each instance finds out on its own first failed query.
let limitedUntil = 0;

function nextUtcMidnight(): number {
  const d = new Date(Date.now());
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Call with any error from D1. True if it was the daily limit (maintenance is now on). */
export function noteDbError(err: unknown): boolean {
  if (!DAILY_LIMIT.test(err instanceof Error ? err.message : String(err))) return false;
  limitedUntil = nextUtcMidnight();
  return true;
}

/** Non-null while the site should show the maintenance page. */
export function maintenance(env: Env): Maintenance | null {
  if (env.MAINTENANCE === "on") return { until: null };
  if (env.MAINTENANCE === "off") return null;
  return Date.now() < limitedUntil ? { until: limitedUntil } : null;
}
