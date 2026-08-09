import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { checkRateLimit } from "./_shared/rate-limit.ts";
import { askToolScribe } from "./_shared/ai-provider.ts";

interface ToolRow {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  icon: string;
  favicon: string;
  upvotes: number;
  price_model: string;
  is_open_source: boolean;
}

interface Recommendation {
  toolId: string;
  name: string;
  reason: string;
  category: string;
  icon: string;
}

interface ToolContext {
  name: string;
  description: string;
  category: string;
  tags: string[];
  features: string[];
  reviewsSummary: string;
}

interface RequestBody {
  query: string;
  toolContext?: ToolContext | null;
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

  const query = (body.query ?? "").trim();
  if (!query) return json({ success: false, message: "Query is required" }, 400);

  const ctx = body.toolContext;

  let systemPrompt: string;
  let userPrompt: string;

  if (ctx) {
    const tagsStr = ctx.tags?.length ? ctx.tags.join(", ") : "None";
    const featuresStr = ctx.features?.length ? ctx.features.join(", ") : "None";
    systemPrompt =
      "You are ToolScribe AI, a helpful assistant for a tool discovery platform.\n\n" +
      "The user is currently viewing a specific tool. Answer their question in the context of this tool.\n\n" +
      "RULES:\n" +
      "- Answer ONLY in the context of the tool described below.\n" +
      "- If the user asks for alternatives, compare against this specific tool.\n" +
      "- If the user asks if it is beginner friendly, evaluate this specific tool.\n" +
      "- If the user asks for tutorials, recommend learning resources for this specific tool.\n" +
      "- Be concise (2-5 sentences).\n" +
      "- If you don't know, say so. Do not invent information.\n" +
      "- Use valid markdown for formatting (**bold**, `code`, lists).";
    userPrompt =
      "The user is viewing this tool:\n\n" +
      `Name: ${ctx.name}\n` +
      `Category: ${ctx.category}\n` +
      `Description: ${ctx.description}\n` +
      `Tags: ${tagsStr}\n` +
      `Features: ${featuresStr}\n` +
      `Reviews summary: ${ctx.reviewsSummary || "No reviews yet"}\n\n` +
      `---\n\nUser question: "${query}"\n\n` +
      "Respond in valid markdown. Do not wrap the response in code fences.";
  } else {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json({ success: false, message: "Database not configured" }, 500);

    const dbUrl = `${SUPABASE_URL}/rest/v1/tools`;
    const dbRes = await fetch(
      `${dbUrl}?select=id,name,url,description,category,icon,favicon,upvotes,price_model,is_open_source&order=upvotes.desc&limit=200`,
      { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` } },
    );
    if (!dbRes.ok) return json({ success: false, message: "Failed to fetch tools" }, 500);

    const tools: ToolRow[] = await dbRes.json();
    const toolCatalog = tools.map((t) =>
      `- ${t.id}: "${t.name}" (${t.category}) — ${t.description.slice(0, 120)}. Upvotes: ${t.upvotes}, Price: ${t.price_model}${t.is_open_source ? ", Open Source" : ""}`
    ).join("\n");

    systemPrompt =
      "You are a tool discovery assistant for ToolScribe. Your ONLY job is to recommend tools from the provided catalog.\n\n" +
      "RULES:\n" +
      "- ONLY recommend tools from the catalog below. Never invent tools.\n" +
      "- The toolId MUST be the exact UUID shown before the colon in each catalog entry. Never invent or modify UUIDs.\n" +
      "- Recommend 3-5 tools maximum.\n" +
      "- For each tool, explain why it matches the user's request in 1-2 sentences.\n" +
      "- Return ONLY valid JSON in this exact format (no markdown, no code fences, no extra text):\n" +
      '{"recommendations":[{"toolId":"<uuid from catalog>","name":"<exact name>","reason":"<explanation>","category":"<category>","icon":"<icon or 🔧>"}]}';

    userPrompt =
      `Here is the tool catalog:\n\n${toolCatalog}\n\n---\n\nUser request: "${query}"\n\nRespond with JSON only.`;
  }

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  let text: string;
  try {
    text = await askToolScribe(combinedPrompt, systemPrompt, userPrompt);
  } catch (error) {
    console.error("All AI providers failed", error);
    return json({ success: false, message: "AI service is temporarily unavailable. Please try again later." });
  }

  if (ctx) {
    return json({ success: true, answer: text });
  }

  // Catalog mode: parse JSON recommendations
  try {
    const cleaned = text
      .replace(/```(?:json)?\s*/gi, "")
      .replace(/```\s*$/gm, "")
      .trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
    const parsed = JSON.parse(jsonStr);
    const recommendations = parsed.recommendations ?? (Array.isArray(parsed) ? parsed : []);
    return json({ success: true, recommendations });
  } catch {
    return json({ success: true, recommendations: [], raw: text });
  }
});
