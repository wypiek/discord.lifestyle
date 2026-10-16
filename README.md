# discord.lifestyle
cool clicker game

## Layout

```
index.html              page shell (meta tags, fonts, #app)
src/client/main.ts      wires the components together
src/client/components/  one file per UI piece (Counter, Rain, Explosion, toggles, Footer, Credits)
src/client/sync.ts      batches clicks to /api/count and polls the shared totals
src/client/sfx.ts       explosion sound
src/client/music.ts     background music
src/client/lib/         small DOM / storage / audio / motion helpers
src/client/assets/      images and audio
src/shared/stats.ts     types shared by the browser and the worker
src/worker.ts           Cloudflare worker: /api/count backed by D1, everything else is static
```

## Commands

```
npm install
npm run dev      # build, then run the worker + local D1 at http://localhost:8787
npm run check    # typecheck client and worker
npm run deploy   # build, then wrangler deploy
```

The site is built by Vite into `dist/`, which wrangler serves as static assets.
