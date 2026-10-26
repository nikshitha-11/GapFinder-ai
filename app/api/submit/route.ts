import { wrap } from "@/lib/server";
import { gen } from "@/lib/ai";
export const maxDuration = 60;

// Correctness is checked in code. The LLM only explains WHY a chosen option is wrong, using the source passage.
export const POST = wrap(async (req, { sb, user }) => {
  const { answers } = await req.json() as { answers: { question_id: string; chosen: number }[] };
  if (!answers?.length) throw new Error("Answer at least one question.");
  const { data: qs } = await sb.from("questions").select("*, chunks(content,page,documents(name))").in("id", answers.map((a) => a.question_id));
  const byId = new Map<string, any>((qs || []).map((q: any) => [q.id, q]));
  const graded = answers.filter((a) => byId.has(a.question_id)).map((a) => {
    const q = byId.get(a.question_id);
    return { ...a, q, is_correct: a.chosen === q.correct };
  });
  const score = graded.filter((g) => g.is_correct).length;
  const { data: att, error } = await sb.from("attempts").insert({ user_id: user.id, total: graded.length, score }).select().single();
  if (error) throw error;
  await sb.from("answers").insert(graded.map((g) => ({
    user_id: user.id, attempt_id: att.id, question_id: g.q.id, topic_id: g.q.topic_id, chosen: g.chosen, is_correct: g.is_correct })));

  const wrong = graded.filter((g) => !g.is_correct);
  let why: Record<string, string> = {};
  if (wrong.length) {
    try {
      const out = await gen<{ items: { id: string; why_wrong: string }[] }>(
        `For each item, explain in 1-2 sentences why the student's chosen option is wrong, using only the passage. ` +
        `Return JSON {"items":[{"id":"","why_wrong":""}]}.\n` +
        JSON.stringify(wrong.map((g) => ({ id: g.q.id, question: g.q.question, chosen: g.q.options[g.chosen], correct: g.q.options[g.q.correct], passage: g.q.chunks?.content }))));
      why = Object.fromEntries((out.items || []).map((i) => [i.id, i.why_wrong]));
    } catch { /* explanation text from generation time is still shown */ }
  }
  return {
    attempt: att.id, score, total: graded.length,
    results: graded.map((g) => ({
      question_id: g.q.id, is_correct: g.is_correct, chosen: g.chosen, correct: g.q.correct,
      explanation: g.q.explanation, why_wrong: why[g.q.id] || null,
    })),
  };
});
