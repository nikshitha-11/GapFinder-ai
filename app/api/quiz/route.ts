import { wrap, MIN_TOPIC_SIM } from "@/lib/server";
import { embed, gen } from "@/lib/ai";
export const maxDuration = 60;

// RETRIEVE chunks per topic (pgvector), then GENERATE questions from only those chunks.
export const POST = wrap(async (req, { sb, user }) => {
  const { perTopic = 2 } = await req.json().catch(() => ({}));
  const { data: topics } = await sb.from("topics").select("*");
  if (!topics?.length) throw new Error("Upload a syllabus first so topics can be mapped.");
  const skipped: string[] = [];
  const made: any[] = [];

  await Promise.all(topics.map(async (t: any) => {
    try {
      const [qe] = await embed([`${t.name}. ${t.description}`]);
      const { data: hits } = await sb.rpc("match_chunks", { query_embedding: qe, match_count: 4, only_kinds: ["notes", "past_paper"] });
      if (!hits?.length || hits[0].similarity < MIN_TOPIC_SIM) { skipped.push(t.name); return; }
      const ctx = hits.map((h: any, i: number) => `[${i + 1}] ${h.content}`).join("\n\n");
      const out = await gen<any>(
        `You write exam questions. Use ONLY the numbered passages below. Do not use outside knowledge.\n` +
        `Write ${perTopic} multiple-choice questions on the topic "${t.name}". Each has exactly 4 options, one correct.\n` +
        `Return JSON {"questions":[{"question":"","options":["","","",""],"correct":0,"explanation":"why the correct option is right, based on the passage","source":1}]}\n` +
        `"correct" is the 0-based index of the right option; "source" is the passage number the question is based on. ` +
        `If the passages cannot support a question, return fewer questions.\n\nPASSAGES:\n${ctx}`);
      for (const q of out.questions || []) {
        const ok = q?.question && Array.isArray(q.options) && q.options.length === 4 && q.correct >= 0 && q.correct <= 3 && hits[q.source - 1];
        if (!ok) continue;
        made.push({ user_id: user.id, topic_id: t.id, question: q.question, options: q.options, correct: q.correct, explanation: q.explanation, source_chunk_id: hits[q.source - 1].id });
      }
    } catch { skipped.push(t.name); }
  }));

  if (!made.length) throw new Error("Could not generate questions. Upload notes that cover your syllabus topics.");
  const { data: rows, error } = await sb.from("questions")
    .insert(made).select("id,topic_id,question,options,topics(name),chunks(content,page,documents(name))");
  if (error) throw error;
  return { questions: rows, skipped }; // `correct` and `explanation` are never sent before submitting
});
