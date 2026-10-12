import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { generateToolProfile } from "../_shared/ai-provider.ts";
import { authenticate } from "../_shared/auth.ts";

interface RequestBody {
  toolId?: string;
  forceRegenerate?: boolean;
  name: string;
  url: string;
  description: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders, "Content-Type": "application/json" },
  });

/** Strip markup and cap the length before the text reaches a paid LLM call. */
async function extractText(res: Response): Promise<string> {
  const html = await res.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

/** Block internal/private addresses and non-HTTP(S) schemes. */
function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    // Whatwg/URL does NOT strip the localhost domain, so api.localhost and
    // db.localhost both arrive intact and the previous `=== 'localhost'`
    // check let them through.
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
    if (hostname === 'local' || hostname.endsWith('.local')) return false;

    // IPv6 literals. The hostname arrives lowercased and, per the URL spec,
    // still bracketed for literals. The dotted-quad regex below cannot see
    // these, so [::1] and the unique-local range used to walk straight through.
    const v6 = hostname.match(/^\[([0-9a-f:]+)\]$/);
    if (v6) return !isPrivateV6(v6[1]);

    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const a = Number(ipMatch[1]);
      const b = Number(ipMatch[2]);
      const c = Number(ipMatch[3]);
      const d = Number(ipMatch[4]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a >= 224) return false;
      // 100.64.0.0/10 carrier-grade NAT, and 192.0.0.0/24 (RFC 6890) which
      // includes the 192.0.0.170 NAT64 discovery address.
      if (a === 100 && b >= 64 && b <= 127) return false;
      if (a === 192 && b === 0 && c === 0) return false;
      // Anything with an octet out of range is not a real address.
      if (b > 255 || c > 255 || d > 255) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * True for IPv6 addresses that reach this machine or the local network.
 * `addr` is the hostname with brackets already stripped.
 *
 * Whatwg/URL normalises IPv6 to its compressed hex form BEFORE we see it, so
 * `[::ffff:169.254.169.254]` arrives as `::ffff:a9fe:a9fe`. A dotted-quad
 * regex here would never match, which is why this works on the hex groups.
 */
function isPrivateV6(addr: string): boolean {
  const a = addr.toLowerCase();

  // An IPv4-mapped or IPv4-compatible address is a 32-bit value in the last
  // two groups. Convert it back to dotted quad and apply the IPv4 rules.
  const mapped = a.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    const quad = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    return !isValidPublicUrl(`http://${quad}`);
  }

  // ::1 loopback and the unspecified address :: (plus its 0:0:... forms).
  if (/^(0*:)*:?(0*)?:1$/.test(a) || /^0*$/.test(a.replace(/:/g, ''))) return true;

  // fc00::/7 unique local; fe80::/10 link local, which covers the provider
  // metadata endpoint fe80::a9fe:a9fe.
  if (/^f[cd]/.test(a)) return true;
  if (/^fe[89ab]/.test(a)) return true;

  return false;
}

/**
 * Strict RFC 4122 UUID check.
 *
 * toolId is interpolated into `?id=eq.${toolId}` on a service-role request, so
 * an unvalidated value lets a caller rewrite the filter — a `,` or `(` turns one
 * equality test into a broader PostgREST expression, and this write bypasses
 * RLS entirely. Validating the shape removes the grammar before it is built.
 */
function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({}, 200);
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  // ─── Authentication ─────────────────────────────────────────
  // This function writes with the service role key, which bypasses RLS.
  // Without this check any anonymous caller could rewrite any tool's
  // ai_summary, and forceRegenerate would let them bill the AI provider.
  const caller = await authenticate(req);
  if (!caller) return json({ success: false, message: "Authentication required" }, 401);

  // Keyed on the authenticated user id, not on an IP header the client
  // controls.
  const rate = await checkRateLimit("generate-ai-profile", caller.userId);
  if (!rate.allowed) {
    return json(
      {
        success: false,
        message: `Too many requests. Try again in ${rate.retryAfter ?? 60}s.`,
      },
      429,
      { "Retry-After": String(rate.retryAfter ?? 60) },
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: "Invalid JSON request" }, 400);
  }

  const { toolId, forceRegenerate, name, url, description } = body;
  console.log("[STEP 1] request", JSON.stringify({ name, hasUrl: !!url, hasToolId: !!toolId, forceRegenerate }));
  if (!name || !url) {
    console.log("[STEP 1b] validation failed: missing name or url");
    return json({ success: false, message: "Name and URL are required" }, 400);
  }

  if (!isValidPublicUrl(url)) {
    return json({ success: false, message: "Invalid URL" }, 400);
  }

  // toolId is interpolated into a service-role `?id=eq.` filter below. Reject
  // anything that is not a UUID rather than encoding it — a comma or paren in
  // the value rewrites the filter, and that request carries the service key.
  if (toolId !== undefined && toolId !== null && !isUuid(toolId)) {
    return json({ success: false, message: "Invalid toolId" }, 400);
  }

  // Writing an existing tool's profile is an admin action (the regenerate
  // button on the tool page). Generation without a toolId is allowed for
  // any signed-in user — that's the submission and moderation flows.
  if (toolId && !caller.isAdmin) {
    return json({ success: false, message: "Admin privileges required to update an existing tool" }, 403);
  }

  // ─── Cache check ──────────────────────────────────────────
  if (toolId && !forceRegenerate) {
    console.log("[STEP 2] checking cache for toolId:", toolId);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const dbUrl = `${SUPABASE_URL}/rest/v1/tools?id=eq.${toolId}&select=ai_summary,ai_profile_generated_at,ai_profile_version`;
      const dbRes = await fetch(dbUrl, {
        headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        const tool = rows?.[0];
        if (tool?.ai_summary) {
          console.log("[STEP 2a] cache HIT, returning cached profile");
          return json({
            success: true,
            profile: tool.ai_summary,
            cached: true,
            generatedAt: tool.ai_profile_generated_at,
            version: tool.ai_profile_version ?? 1,
          });
        } else {
          console.log("[STEP 2b] cache MISS (no ai_summary in row)");
        }
      } else {
        console.log("[STEP 2c] cache check DB request failed", dbRes.status);
        const errText = await dbRes.text();
        console.log("[STEP 2c] DB error body:", errText.slice(0, 500));
      }
    } else {
      console.log("[STEP 2d] SUPABASE_URL/SERVICE_KEY env vars missing");
    }
  } else {
    console.log("[STEP 2e] skipping cache check:", { toolId: !!toolId, forceRegenerate });
  }

  console.log("[STEP 3] generating new profile");

  // Fetch homepage content
  let pageContent = "";
  try {
    let textContent = "";
    console.log("[STEP 3a] fetching page content from:", url);
    // redirect: "manual" — without it fetch follows redirects by default, so a
    // host that passes isValidPublicUrl can 302 to 169.254.169.254 and the
    // allowlist means nothing. We resolve the redirect target ourselves and
    // re-validate it.
    const pageRes = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
      headers: { "User-Agent": "ToolScribe/1.0 (AI Profile Generator)" },
    });

    if (pageRes.status >= 300 && pageRes.status < 400) {
      const location = pageRes.headers.get("location");
      if (!location) {
        return json({ success: false, message: "Failed to fetch page" }, 502);
      }
      let resolved: string;
      try {
        resolved = new URL(location, url).toString();
      } catch {
        return json({ success: false, message: "Invalid redirect" }, 502);
      }
      // Re-run the SSRF check against wherever the redirect points.
      if (!isValidPublicUrl(resolved)) {
        console.warn("[STEP 3a] blocked redirect to non-public host");
        return json({ success: false, message: "Invalid redirect" }, 502);
      }
      console.log("[STEP 3a] following validated redirect to:", resolved);
      const followed = await fetch(resolved, {
        signal: AbortSignal.timeout(8000),
        redirect: "manual",
        headers: { "User-Agent": "ToolScribe/1.0 (AI Profile Generator)" },
      });
      if (!followed.ok) {
        return json({ success: false, message: "Failed to fetch page" }, 502);
      }
      textContent = await extractText(followed);
    }
    console.log("[STEP 3a] page fetch status:", pageRes.status);
    if (pageRes.ok) {
      textContent = await extractText(pageRes);
    } else {
      console.log("[STEP 3a] page fetch not OK");
    }

    if (textContent.length > 0) {
      pageContent = textContent;
      console.log("[STEP 3a] page content extracted, length:", pageContent.length);
    }
  } catch (err) {
    console.log("[STEP 3a] page fetch error:", err instanceof Error ? err.message : String(err));
    pageContent = "(could not fetch page content)";
  }

  const systemPrompt =
    "You are writing a tool directory profile.\n\n" +
    "Write exactly one paragraph between 80 and 120 words.\n\n" +
    "Explain:\n" +
    "- What the tool actually does\n" +
    "- Who typically uses it\n" +
    "- What makes it different from competitors\n" +
    "- Main strengths\n" +
    "- Important limitations\n" +
    "- Pricing model if known\n\n" +
    "RULES:\n" +
    "- Do not repeat the tool name more than once.\n" +
    "- Do not use marketing language.\n" +
    "- Do not use phrases like: problem solver, empowers users, innovative, cutting-edge, powerful\n" +
    "- Write like a reviewer who has actually used the tool.\n" +
    "- Mention realistic use cases.\n" +
    "- Mention tradeoffs when relevant.\n" +
    "- Return only the paragraph.\n" +
    "- No headings.\n" +
    "- No bullet points.\n" +
    "- No markdown.\n" +
    "- Use ONLY factual information from the provided data.\n" +
    "- Do NOT invent features, use cases, or pricing.";

  const userPrompt =
    "Tool:\n" +
    `${name}\n\n` +
    `Website:\n${url}\n\n` +
    `Existing Description:\n${description}\n\n` +
    `Website content:\n${pageContent.slice(0, 3000)}\n\n` +
    "Write exactly one paragraph between 80 and 120 words. Output only the paragraph.";

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  let generatedProfile: string;
  try {
    console.log("[STEP 4] calling generateToolProfile");
    generatedProfile = await generateToolProfile(combinedPrompt, systemPrompt, userPrompt);
    console.log("[STEP 4] generation succeeded, profile length:", generatedProfile.length);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[STEP 4] All AI providers failed:", errMsg);
    return json({ success: false, message: `AI service is temporarily unavailable. Please try again later. (${errMsg})` });
  }

  // ─── Save to database ─────────────────────────────────────
  if (toolId) {
    console.log("[STEP 5] saving to database for toolId:", toolId);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      // Fetch current version to increment
      let currentVersion = 0;
      const verUrl = `${SUPABASE_URL}/rest/v1/tools?id=eq.${toolId}&select=ai_profile_version`;
      console.log("[STEP 5a] fetching current version");
      const verRes = await fetch(verUrl, {
        headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (verRes.ok) {
        const verRows = await verRes.json();
        currentVersion = verRows?.[0]?.ai_profile_version ?? 0;
        console.log("[STEP 5a] current version:", currentVersion);
      } else {
        console.log("[STEP 5a] version fetch failed", verRes.status);
      }

      const saveUrl = `${SUPABASE_URL}/rest/v1/tools?id=eq.${toolId}`;
      console.log("[STEP 5b] saving profile, new version:", currentVersion + 1);
      const saveRes = await fetch(saveUrl, {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          ai_summary: generatedProfile,
          ai_profile_generated_at: new Date().toISOString(),
          ai_profile_version: currentVersion + 1,
        }),
      });
      if (saveRes.ok) {
        console.log("[STEP 5b] saved profile successfully");
      } else {
        const saveErr = await saveRes.text();
        console.error("[STEP 5b] failed to save profile:", saveRes.status, saveErr.slice(0, 500));
      }
    } else {
      console.log("[STEP 5c] SUPABASE_URL/SERVICE_KEY env vars missing, cannot save");
    }
  } else {
    console.log("[STEP 5d] no toolId provided, skipping DB save");
  }

  console.log("[STEP 6] returning success response");
  return json({
    success: true,
    profile: generatedProfile,
    cached: false,
  });
});
