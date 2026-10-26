// LLM layer (Gemini REST). embed() = retrieval side, gen() = generation side.
const B = "https://generativelanguage.googleapis.com/v1beta/models";
const key = () => process.env.GEMINI_API_KEY!;
const post = (url: string, body: any) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export async function embed(texts: string[]): Promise<number[][]> {
  const model = process.env.EMBED_MODEL || "gemini-embedding-001";
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 90) {
    const j = await post(`${B}/${model}:batchEmbedContents?key=${key()}`, {
      requests: texts.slice(i, i + 90).map((t) => ({
        model: `models/${model}`, content: { parts: [{ text: t }] }, outputDimensionality: 768,
      })),
    });
    if (!j.embeddings) throw new Error("Embedding failed: " + JSON.stringify(j).slice(0, 300));
    out.push(...j.embeddings.map((e: any) => e.values));
  }
  return out;
}

// Structured JSON generation. Callers validate the shape they get back.
export async function gen<T = any>(prompt: string): Promise<T> {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const j = await post(`${B}/${model}:generateContent?key=${key()}`, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
  });
  const t = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!t) throw new Error("Generation failed: " + JSON.stringify(j).slice(0, 300));
  return JSON.parse(t);
}
