import { wrap, MIN_CHAT_SIM } from "@/lib/server";
import { embed, gen } from "@/lib/ai";

// Explain-This-Topic: retrieve first, refuse if nothing relevant, otherwise answer ONLY from retrieved passages.
export const POST = wrap(async (req, { sb }) => {
  const { question } = await req.json();
  if (!question?.trim()) throw new Error("Ask a question about your material.");
  const [qe] = await embed([question]);
  const { data: hits } = await sb.rpc("match_chunks", { query_embedding: qe, match_count: 5, only_kinds: ["notes", "past_paper"] });
  if (!hits?.length || hits[0].similarity < MIN_CHAT_SIM)
    return { answer: "Not found in your uploaded material. Try rephrasing, or upload notes that cover this.", citations: [] };
  const ctx = hits.map((h: any, i: number) => `[${i + 1}] (${h.doc_name}, p.${h.page}) ${h.content}`).join("\n\n");
  const out = await gen<{ answer: string; used: number[] }>(
    `Answer the question using ONLY the numbered passages. Cite passages inline like [1]. ` +
    `If the passages do not contain the answer, set answer to "Not found in your uploaded material." and used to [].\n` +
    `Return JSON {"answer":"","used":[passage numbers]}.\n\nPASSAGES:\n${ctx}\n\nQUESTION: ${question}`);
  const citations = (out.used || []).filter((n) => hits[n - 1]).map((n) => ({ n, doc: hits[n - 1].doc_name, page: hits[n - 1].page, snippet: hits[n - 1].content.slice(0, 220) }));
  return { answer: out.answer, citations };
});
