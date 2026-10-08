// ─── Database-backed rate limiting ────────────────────────────
//
// The previous implementation kept counters in an in-process Map. That is
// not a rate limit in practice: edge functions run many horizontally-scaled
// containers that recycle constantly, so the effective ceiling was
// "containers × 10/minute" and a cold route handed out a fresh bucket. It
// was also keyed on x-forwarded-for, a header the client sets freely.
//
// Counters now live in Postgres and are keyed on the authenticated user id,
// which authenticate() has already verified. The counter update is a single
// atomic upsert, so concurrent requests from the same user cannot race past
// the limit.

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

interface RateLimitRow {
  allowed: boolean;
  retry_after: number | null;
}

function env(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

/**
 * Counts one request against `identity`'s budget for `bucket`.
 *
 * `identity` must be a server-derived identifier (the authenticated user id).
 * Never pass a client-supplied value.
 *
 * Fails OPEN if the database is unreachable. Rate limiting is a cost
 * control, not the security boundary — authentication is — and taking every
 * user's AI features down during a database blip is the worse trade. Failures
 * are logged so they are visible.
 */
export async function checkRateLimit(
  bucket: string,
  identity: string,
): Promise<RateLimitResult> {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("[rate-limit] SUPABASE_URL/SERVICE_ROLE_KEY missing, allowing request");
    return { allowed: true };
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_key: `${bucket}:${identity}`,
        p_limit: MAX_REQUESTS,
        p_window_seconds: WINDOW_SECONDS,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[rate-limit] rpc failed (${res.status}): ${body.slice(0, 200)}`);
      return { allowed: true };
    }

    const rows = (await res.json()) as RateLimitRow[];
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.allowed !== "boolean") {
      console.error("[rate-limit] unexpected rpc response shape");
      return { allowed: true };
    }

    return {
      allowed: row.allowed,
      retryAfter: row.retry_after ?? undefined,
    };
  } catch (err) {
    console.error("[rate-limit] request failed:", err instanceof Error ? err.message : String(err));
    return { allowed: true };
  }
}