// Fixed-window rate limiter. Pages Functions have no rate limiting binding, so this
// counts in memory.
// ponytail: per worker instance, not global; a determined bot spread across instances
// gets more. For a hard limit, add a WAF rate limiting rule on your custom domain.

const MAX_KEYS = 10_000; // memory bound; past this the oldest windows are dropped

export function createLimiter(limit: number, periodMs: number) {
  const windows = new Map<string, { start: number; hits: number }>();
  /** True if this request for `key` is within the limit. */
  return (key: string): boolean => {
    const now = Date.now();
    let w = windows.get(key);
    if (!w || now - w.start >= periodMs) {
      windows.delete(key);
      if (windows.size >= MAX_KEYS) windows.delete(windows.keys().next().value!);
      w = { start: now, hits: 0 };
      windows.set(key, w); // re-inserted, so Map order stays oldest-first
    }
    return ++w.hits <= limit;
  };
}

/** Rate limit key for an IP. IPv6 hosts usually own a whole /64, so it counts as one. */
export function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups.slice(0, 4).map(g => (parseInt(g, 16) || 0).toString(16)).join(":") + "::/64";
}
