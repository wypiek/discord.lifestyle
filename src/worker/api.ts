// API for "delete discord.", run by Pages Functions (functions/api/[[path]].ts).
//   GET  /api/count   shared totals
//   POST /api/count   add clicks (needs a human-check session)
//   POST /api/verify  trade a Turnstile token for a session cookie

import { addClicks, getStats } from "./counter";
import type { Env } from "./env";
import { checkTurnstile, newSession, sessionId } from "./human";
import { createLimiter } from "./limiter";
import { maintenance } from "./maintenance";

const readOk = createLimiter(300, 60_000); // per IP: polling every 2s leaves room for shared IPs
const clickOk = createLimiter(20, 10_000); // per human-check session

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const tooMany = () => json({ error: "rate limited" }, 429, { "retry-after": "10" });

function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin GETs and some beacons omit it
  try { return new URL(origin).host === url.host; } catch { return false; }
}

async function readCount(env: Env, ip: string): Promise<Response> {
  if (!readOk(ip)) return tooMany();
  const down = await maintenance(env);
  if (down) return json({ error: "maintenance", ...down }, 503);
  return json(await getStats(env.DB!));
}

async function postCount(request: Request, env: Env): Promise<Response> {
  const down = await maintenance(env);
  if (down) return json({ error: "maintenance", ...down }, 503);
  const session = await sessionId(env, request);
  if (!session) return json({ error: "verify" }, 401);
  if (!clickOk(session)) return tooMany();

  const body = await request.json<{ count?: unknown }>().catch(() => null);
  const n = Math.floor(Number(body?.count));
  if (!Number.isFinite(n) || n < 1) return json({ error: "bad count" }, 400);
  return json(await addClicks(env.DB!, n));
}

async function verify(request: Request, env: Env, ip: string): Promise<Response> {
  if (!readOk(`verify:${ip}`)) return tooMany();
  const body = await request.json<{ token?: unknown }>().catch(() => null);
  if (typeof body?.token !== "string" || !body.token) return json({ error: "missing token" }, 400);
  if (!(await checkTurnstile(env, body.token, ip))) return json({ error: "not human" }, 403);
  const { cookie, expires } = await newSession(env);
  return json({ expires }, 200, { "set-cookie": cookie });
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!env.DB) return json({ error: "D1 binding named DB is missing" }, 500);
  if (request.method !== "GET" && !sameOrigin(request, url)) return json({ error: "forbidden" }, 403);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  try {
    switch (`${request.method} ${url.pathname}`) {
      case "GET /api/count": return await readCount(env, ip);
      case "POST /api/count": return await postCount(request, env);
      case "POST /api/verify": return await verify(request, env, ip);
    }
    return json({ error: "not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "server error" }, 500);
  }
}
