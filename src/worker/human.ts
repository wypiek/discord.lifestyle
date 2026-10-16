// Human check: the browser solves an invisible Turnstile challenge once, then gets a
// signed session cookie. Clicks are only accepted with a valid session, so Turnstile
// isn't needed on every request (its tokens are single-use).

import type { Env } from "./env";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const COOKIE = "human";
const SESSION_S = 60 * 60;
const enc = new TextEncoder();

const toB64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** Asks Cloudflare whether a Turnstile token is genuine and unused. */
export async function checkTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) throw new Error("TURNSTILE_SECRET is not set");
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch(SITEVERIFY, { method: "POST", body: form });
  const out = await res.json<{ success?: boolean }>();
  return out.success === true;
}

/** New signed session as a Set-Cookie value, plus when it expires (epoch ms). */
export async function newSession(env: Env): Promise<{ cookie: string; expires: number }> {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET is not set");
  const exp = Math.floor(Date.now() / 1000) + SESSION_S;
  const payload = `${exp}.${crypto.randomUUID()}`;
  const sig = toB64url(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload)));
  return {
    cookie: `${COOKIE}=${payload}.${sig}; Path=/api; Max-Age=${SESSION_S}; HttpOnly; Secure; SameSite=Strict`,
    expires: exp * 1000,
  };
}

/** The session id from a valid, unexpired cookie, or null. */
export async function sessionId(env: Env, request: Request): Promise<string | null> {
  if (!env.SESSION_SECRET) return null;
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)human=([^;]+)/)?.[1];
  const [exp, id, sig] = raw?.split(".") ?? [];
  if (!exp || !id || !sig || Number(exp) * 1000 < Date.now()) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env.SESSION_SECRET), fromB64url(sig), enc.encode(`${exp}.${id}`));
    return ok ? id : null;
  } catch {
    return null; // malformed signature
  }
}
