import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { generateToolProfile } from "../_shared/ai-provider.ts";

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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

/** Block internal/private addresses and non-HTTP(S) schemes. */
function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname.endsWith('.local')) return false;
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const a = Number(ipMatch[1]);
      const b = Number(ipMatch[2]);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 127) return false;
      if (a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a >= 224) return false;
    }
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({}, 200);
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rate = checkRateLimit(clientIp);
  if (!rate.allowed) {
    return json({ success: false, message: "Too many requests. Please try again later." }, 429);
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
    console.log("[STEP 3a] fetching page content from:", url);
    const pageRes = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ToolScribe/1.0 (AI Profile Generator)" },
    });
    console.log("[STEP 3a] page fetch status:", pageRes.status);
    if (pageRes.ok) {
      const html = await pageRes.text();
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[^;]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      pageContent = textContent;
      console.log("[STEP 3a] page content extracted, length:", pageContent.length);
    } else {
      console.log("[STEP 3a] page fetch not OK");
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
