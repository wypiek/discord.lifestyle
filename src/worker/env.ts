export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  /** GET /api/count and /api/verify, keyed by IP. */
  READ_LIMITER: RateLimit;
  /** POST /api/count, keyed by human-check session. */
  CLICK_LIMITER: RateLimit;

  /** Secret: Turnstile widget secret key. */
  TURNSTILE_SECRET?: string;
  /** Secret: random string used to sign session cookies. */
  SESSION_SECRET?: string;

  /** "auto" (default) watches D1 usage, "on" forces the maintenance page, "off" never shows it. */
  MAINTENANCE?: string;
  CF_ACCOUNT_ID?: string;
  /** Secret: API token with Account Analytics: Read, used to watch D1 usage. */
  CF_API_TOKEN?: string;
  /** Daily account-wide D1 limits for your plan. */
  DB_DAILY_READ_LIMIT?: string;
  DB_DAILY_WRITE_LIMIT?: string;
}
