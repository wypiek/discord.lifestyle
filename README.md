# discord.lifestyle
cool clicker game

## Layout

```
index.html              page shell (meta tags, fonts, #app)
src/client/main.ts      wires the components together
src/client/components/  one file per UI piece (Counter, Rain, Explosion, toggles, Footer, Credits)
src/client/sync.ts      batches clicks to /api/count and polls the shared totals
src/client/human.ts     invisible Turnstile check, traded for a session cookie
src/client/sfx.ts       explosion sound
src/client/music.ts     background music
src/client/lib/         small DOM / storage / audio / motion helpers
src/client/assets/      images and audio
src/shared/stats.ts     types shared by the browser and the worker
functions/api/[[path]].ts  Pages Functions entry for /api/*
src/worker/api.ts       routes, origin check, rate limits
src/worker/counter.ts   D1 queries and per-session click budget
src/worker/human.ts     Turnstile verification and signed session cookies
src/worker/maintenance.ts  switches on the maintenance page when D1's daily limits are hit
src/worker/limiter.ts   in-memory rate limiter
test/                   `npm test`
```

## Commands

```
npm install
cp .dev.vars.example .dev.vars   # local secrets (Turnstile test keys)
npm run dev      # build, then run it like Pages (Functions + local D1) at http://localhost:8787
npm run check    # typecheck client and functions
npm test         # session signing, maintenance, rate limits and click budget
```

## Cloudflare Pages setup

Pushing to `main` deploys. Everything below is set in the dashboard under
Workers & Pages > your project > Settings.

- **Build**: build command `npm run build`, build output directory `dist`.
- **Bindings**: D1 database, variable name `DB`.
- **Variables and Secrets**:
  - `VITE_TURNSTILE_SITE_KEY`: site key of your Turnstile widget (create one under
    Turnstile > Add widget, mode Invisible). Used at build time.
  - `TURNSTILE_SECRET` (secret): that widget's secret key.
  - `SESSION_SECRET` (secret): a long random string, e.g. `openssl rand -base64 32`.
  - `MAINTENANCE`: `on` shows the maintenance page by hand, `off` disables it. By default
    it turns on by itself when D1 refuses queries for hitting the free plan's daily row
    limit, and stays on until 00:00 UTC when the limits reset. No account secrets needed.
- **Runtime**: compatibility date `2025-09-01` or later.

Redeploy after changing settings.

## Anti-spam

- Clicks need a session cookie, which costs an invisible Turnstile check. At most 30 new
  sessions per IP (IPv6: per /64) every 10 minutes.
- Each session has a click budget in D1 (`budget` table): 100 clicks up front, refilling at
  20 per second. Anything over the budget isn't counted; the browser re-queues it, so real
  clickers lose nothing. Being in D1, it holds across all worker instances.
- Request limits (300 reads/min per IP, 20 click batches per 10 s per session) are counted
  per worker instance, since Pages has no rate limiting binding; they mainly keep floods
  off D1. For a strict global request limit add a WAF rate limiting rule on a custom domain.
