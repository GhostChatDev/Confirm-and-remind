// Small fixed-window rate limiter (in memory; per server instance). For multiple instances use a shared store.
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000, now = Date.now()): boolean {
  const h = hits.get(key);
  if (!h || now >= h.reset) {
    if (hits.size > 5000) for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  h.count += 1;
  return h.count <= limit;
}

export function resetRateLimits() { hits.clear(); }
