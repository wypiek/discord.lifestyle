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
src/worker/index.ts     Cloudflare worker: routes, rate limits; everything else is static
src/worker/counter.ts   D1 queries
src/worker/human.ts     Turnstile verification and signed session cookies
src/worker/maintenance.ts  switches on the maintenance page near D1's daily limits
test/                   `npm test`
```

## Commands

```
npm install
cp .dev.vars.example .dev.vars   # local secrets (Turnstile test keys)
npm run dev      # build, then run the worker + local D1 at http://localhost:8787
npm run check    # typecheck client and worker
npm test         # session signing and maintenance logic
npm run deploy   # build, then wrangler deploy
```

## Production setup

1. **Turnstile**: create a widget in the Cloudflare dashboard (Invisible, or Managed for a
   checkbox only when Cloudflare is unsure). Put its site key in `.env.production`, then
   `npx wrangler secret put TURNSTILE_SECRET`.
2. **Sessions**: `npx wrangler secret put SESSION_SECRET` with a long random string
   (`openssl rand -base64 32`).
3. **Maintenance page**: set `CF_ACCOUNT_ID` in `wrangler.jsonc`, create an API token with
   *Account Analytics: Read*, and `npx wrangler secret put CF_API_TOKEN`. At 90% of
   `DB_DAILY_READ_LIMIT` / `DB_DAILY_WRITE_LIMIT` the site shows the maintenance page until
   00:00 UTC. Set `MAINTENANCE` to `"on"` to show it by hand. Without the token the
   automatic check is off.

Rate limits (in `wrangler.jsonc`): 300 reads per minute per IP, 20 click batches per 10 s
per session.

The site is built by Vite into `dist/`, which wrangler serves as static assets.
