// Everything here is set in the Pages dashboard: Settings > Bindings (DB) and
// Settings > Variables and Secrets (the rest). Locally, `npm run dev` passes DB and
// reads the rest from .dev.vars.
export interface Env {
  DB?: D1Database;

  /** Secret: Turnstile widget secret key. */
  TURNSTILE_SECRET?: string;
  /** Secret: random string used to sign session cookies. */
  SESSION_SECRET?: string;

  /** "auto" (default) shows the maintenance page once D1's daily limit is hit, "on" forces
   *  it, "off" never shows it. */
  MAINTENANCE?: string;
}
