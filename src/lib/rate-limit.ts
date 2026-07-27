import "server-only";
import { headers } from "next/headers";

// In-memory fixed-window limiter. Per-instance only: on Vercel each lambda has
// its own map, so treat this as friction against scripted abuse rather than a
// hard global guarantee. Good enough for a login form and a public request form;
// swap for Upstash if real distributed limits are ever needed.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

function clientKey(scope: string): string {
  const h = headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  scope: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const key = clientKey(scope);
  const now = Date.now();

  // Cheap guard against unbounded growth on a long-lived instance.
  if (buckets.size > MAX_TRACKED_KEYS) {
    buckets.forEach((bucket, k) => {
      if (bucket.resetAt <= now) buckets.delete(k);
    });
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}
