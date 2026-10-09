// ─── Model Configuration ─────────────────────────────────────
const MODEL_CONFIG = {
  generateToolProfile: {
    primary: "google/gemma-4-31b-it:free",
    secondary: "meta-llama/llama-3.3-70b-instruct:free",
    temperature: 0.3,
    maxOutputTokens: 1024,
  },
  askToolScribe: {
    primary: "openai/gpt-oss-120b:free",
    secondary: "meta-llama/llama-3.3-70b-instruct:free",
    temperature: 0.3,
    maxOutputTokens: 4096,
  },
  compareTools: {
    primary: "deepseek/deepseek-r1-0528:free",
    secondary: "meta-llama/llama-3.3-70b-instruct:free",
    temperature: 0.3,
    maxOutputTokens: 4096,
  },
} as const;

type TaskConfig = (typeof MODEL_CONFIG)[keyof typeof MODEL_CONFIG];

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ─── Core API calls ─────────────────────────────────────────

async function callOpenRouterRaw(prompt: string, model: string, temperature: number, maxTokens: number): Promise<{ status: number; body: string }> {
  const key = Deno.env.get("OPENROUTER_API_KEY");

  const requestBody = { model, messages: [{ role: "user", content: prompt }], temperature, max_tokens: maxTokens };

  console.log("=== OPENROUTER REQUEST ===");
  console.log(JSON.stringify({
    model,
    endpoint: OPENROUTER_URL,
    hasApiKey: !!key,
    requestBody: { model, messages: [{ role: "user", content: prompt.slice(0, 200) }], temperature, max_tokens: maxTokens },
  }));

  if (!key) throw new Error("OPENROUTER_API_KEY not configured");

  console.log("API KEY FOUND: true");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(requestBody),
  });

  console.log("=== OPENROUTER RESPONSE ===");
  console.log(JSON.stringify({
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
  }));

  const rawText = await res.text();
  console.log("RAW OPENROUTER RESPONSE:");
  console.log(rawText);

  return { status: res.status, body: rawText };
}

async function callGemini(systemPrompt: string, userPrompt: string, maxOutputTokens: number): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${errText}`);
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

// ─── Fallback chain with structured logging ───────────────────

async function generateWithFallback(
  combinedPrompt: string,
  systemPrompt: string,
  userPrompt: string,
  cfg: TaskConfig,
): Promise<string> {
  const models = [cfg.primary, cfg.secondary];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    console.log("");
    console.log(`MODEL USED: ${model}`);
    try {
      const r = await callOpenRouterRaw(combinedPrompt, model, cfg.temperature, cfg.maxOutputTokens);
      if (r.status === 200) {
        try {
          const data = JSON.parse(r.body);
          const content = (data.choices?.[0]?.message?.content ?? "").trim();
          if (content) {
            console.log(`MODEL SUCCEEDED: ${model}`);
            return content;
          }
        } catch {
          // parse failed, try next
        }
      }
      console.log(`MODEL FAILED: ${model} (status ${r.status})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`MODEL FAILED: ${model} (${msg})`);
    }

    if (i < models.length - 1) {
      console.log(`FALLBACK USED: ${models[i + 1]}`);
    }
  }

  console.log("Using Gemini fallback");
  try {
    return await callGemini(systemPrompt, userPrompt, cfg.maxOutputTokens);
  } catch (geminiErr) {
    const geminiMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    throw new Error(`Gemini fallback failed: ${geminiMsg}`);
  }
}

// ─── Task-specific exports ──────────────────────────────────

export async function generateToolProfile(
  combinedPrompt: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  return generateWithFallback(combinedPrompt, systemPrompt, userPrompt, MODEL_CONFIG.generateToolProfile);
}

export async function askToolScribe(
  combinedPrompt: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  return generateWithFallback(combinedPrompt, systemPrompt, userPrompt, MODEL_CONFIG.askToolScribe);
}

export async function compareTools(
  combinedPrompt: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  return generateWithFallback(combinedPrompt, systemPrompt, userPrompt, MODEL_CONFIG.compareTools);
}
