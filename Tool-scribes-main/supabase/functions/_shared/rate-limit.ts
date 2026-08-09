const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS = 10;  // max 10 requests per IP per window

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

// Periodic cleanup to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, WINDOW_MS);