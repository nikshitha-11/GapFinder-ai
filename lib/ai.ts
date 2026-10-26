// LLM layer (Gemini REST). embed() = retrieval side, gen() = generation side.
// Every call has a hard timeout and bounded retries, so a slow or overloaded model can never hang a request.
const B = "https://generativelanguage.googleapis.com/v1beta/models";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The key goes in a header (not the URL) so it can never show up in logs or error messages.
const headers = () => ({ "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY || "" });
const retryable = (s: number) => s === 0 || s === 408 || s === 429 || s >= 500;

// One HTTP call with a timeout. It never throws: it returns the status and whatever body came back.
async function call(url: string, body: any, timeoutMs: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body, e.g. a gateway error page */ }
    return { status: r.status, ok: r.ok, json, text };
  } catch (e: any) {
    const timedOut = e?.name === "AbortError";
    return { status: timedOut ? 408 : 0, ok: false, json: null, text: timedOut ? "timed out" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}

export async function embed(texts: string[], opts: { timeoutMs?: number; attempts?: number } = {}): Promise<number[][]> {
  const model = process.env.EMBED_MODEL || "gemini-embedding-001";
  const timeoutMs = opts.timeoutMs ?? 30000, attempts = opts.attempts ?? 3;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 90) {
    const body = {
      requests: texts.slice(i, i + 90).map((t) => ({
        model: `models/${model}`, content: { parts: [{ text: t }] }, outputDimensionality: 768,
      })),
    };
    let last = "", done = false;
    for (let a = 0; a < attempts && !done; a++) {
      const r = await call(`${B}/${model}:batchEmbedContents`, body, timeoutMs);
      if (r.ok && r.json?.embeddings) { out.push(...r.json.embeddings.map((e: any) => e.values)); done = true; continue; }
      last = `${r.status} ${(r.json?.error?.message || r.text).slice(0, 200)}`;
      if (!retryable(r.status)) break;
      await sleep(800 * (a + 1));
    }
    if (!done) throw new Error("Embedding failed: " + last);
  }
  return out;
}

// Structured JSON generation. Callers validate the shape they get back.
// Up to 3 attempts inside one time budget: primary model, then GEMINI_FALLBACK_MODEL (if set), then primary again.
export async function gen<T = any>(prompt: string, opts: { budgetMs?: number } = {}): Promise<T> {
  const primary = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "";
  const think = process.env.GEMINI_THINKING_LEVEL || ""; // optional: "low" or "minimal" makes thinking models answer faster
  const budget = opts.budgetMs ?? 38000, started = Date.now();
  let useThink = !!think, last = "no attempt was made";

  for (let attempt = 0; attempt < 3; attempt++) {
    const left = budget - (Date.now() - started);
    if (left < 4000) { last += " (out of time)"; break; }
    const model = attempt === 1 && fallback ? fallback : primary;
    const r = await call(`${B}/${model}:generateContent`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 4096,
        ...(useThink ? { thinkingConfig: { thinkingLevel: think } } : {}),
      },
    }, Math.min(22000, left));

    const parts: any[] = r.json?.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
    if (r.ok && text) {
      try { return JSON.parse(text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")); }
      catch { last = `${model}: the model returned invalid JSON`; continue; }
    }
    last = `${model}: ${r.status} ${(r.json?.error?.message || (r.ok ? "empty response" : r.text)).slice(0, 160)}`;
    if (r.status === 400 && useThink) { useThink = false; attempt--; continue; } // model rejected the thinking setting: retry without it
    if (!retryable(r.status) && r.status !== 404) break;                           // bad key or bad request: retrying will not help
    if (r.status === 429 || r.status >= 500) await sleep(700);
  }
  throw new Error("Generation failed: " + last);
}