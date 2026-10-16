// Everything here is set in the Pages dashboard: Settings > Bindings (DB) and
// Settings > Variables and Secrets (the rest). Locally, `npm run dev` passes DB and
// reads the rest from .dev.vars.
export interface Env {
  DB?: D1Database;

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
