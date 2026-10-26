import { wrap, level } from "@/lib/server";
import { gen } from "@/lib/ai";
export const maxDuration = 60;

async function latest(sb: any) {
  const { data } = await sb.from("plans").select("data,created_at").order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.data || null;
}
export const GET = wrap(async (_r, { sb }) => ({ report: await latest(sb) }));

// Scores, levels and time allocation are deterministic code. The LLM only writes the reasons and task wording.
export const POST = wrap(async (req, { sb, user }) => {
  const { hoursPerDay = 2, days = 7 } = await req.json().catch(() => ({}));
  const { data: att } = await sb.from("attempts").select("id").order("created_at", { ascending: false }).limit(1);
  if (!att?.length) throw new Error("Take a diagnostic quiz first.");
  const { data: ans } = await sb.from("answers").select("is_correct,chosen,topic_id,topics(name),questions(question,options,correct)").eq("attempt_id", att[0].id);

  const g = new Map<string, any>();
  for (const a of ans || []) {
    const t = g.get(a.topic_id) || { topic: a.topics.name, right: 0, total: 0, missed: [] as any[] };
    t.total++; a.is_correct ? t.right++ : t.missed.push({ q: a.questions?.question, yours: a.questions?.options?.[a.chosen], correct: a.questions?.options?.[a.questions?.correct] });
    g.set(a.topic_id, t);
  }
  const topics = [...g.values()].map((t) => ({ ...t, score: t.right / t.total, level: level(t.right / t.total) }));

  // Reasons (LLM, grounded in the actual wrong answers) with a deterministic fallback
  let reasons: Record<string, string> = {};
  try {
    const out = await gen<{ items: { topic: string; reason: string }[] }>(
      `For each topic write a 1-2 sentence diagnosis of the student's gap, based ONLY on the missed questions listed. ` +
      `If nothing was missed, say what they showed they know. Return JSON {"items":[{"topic":"","reason":""}]}.\n` +
      JSON.stringify(topics.map((t) => ({ topic: t.topic, score: `${t.right}/${t.total}`, missed: t.missed }))));
    reasons = Object.fromEntries((out.items || []).map((i) => [i.topic, i.reason]));
  } catch {}
  const gaps = topics.map((t) => ({
    topic: t.topic, right: t.right, total: t.total, pct: Math.round(t.score * 100), level: t.level,
    reason: reasons[t.topic] || `Answered ${t.right} of ${t.total} correctly.`,
  })).sort((a, b) => a.pct - b.pct);

  // Allocation: weight = (1 - score) + 0.15, so strong topics still get a short review slot
  const totalMin = Math.round(hoursPerDay * days * 60);
  const w = gaps.map((x) => 1 - x.pct / 100 + 0.15), sum = w.reduce((a, b) => a + b, 0);
  const alloc = gaps.map((x, i) => ({ ...x, minutes: Math.max(10, Math.round((totalMin * w[i]) / sum / 5) * 5), tasks: [] as string[] }));

  try {
    const out = await gen<{ items: { topic: string; tasks: string[] }[] }>(
      `Write 2-3 short, concrete revision tasks per topic for a student. Use the missed questions as hints; for strong topics suggest quick review. ` +
      `Return JSON {"items":[{"topic":"","tasks":[""]}]}.\n` +
      JSON.stringify(alloc.map((a) => ({ topic: a.topic, level: a.level, minutes: a.minutes, missed: g.get([...g.keys()].find((k) => g.get(k).topic === a.topic))?.missed.map((m: any) => m.q) }))));
    for (const it of out.items || []) { const a = alloc.find((x) => x.topic === it.topic); if (a) a.tasks = it.tasks || []; }
  } catch {}
  alloc.forEach((a) => { if (!a.tasks.length) a.tasks = [`Re-read your notes on ${a.topic}`, "Redo the missed questions"]; });

  // Schedule: weakest first, filling each day's time budget
  const plan: { day: number; sessions: any[] }[] = []; let day = 1, left = hoursPerDay * 60;
  for (const a of alloc) {
    let rem = a.minutes;
    while (rem > 0 && day <= days + 5) {
      const take = Math.min(rem, left);
      let d = plan.find((p) => p.day === day); if (!d) plan.push((d = { day, sessions: [] }));
      d.sessions.push({ topic: a.topic, level: a.level, minutes: take, tasks: a.tasks });
      rem -= take; left -= take;
      if (left <= 0) { day++; left = hoursPerDay * 60; }
    }
  }
  const report = { attempt: att[0].id, hoursPerDay, days, gaps, plan };
  await sb.from("plans").insert({ user_id: user.id, attempt_id: att[0].id, data: report });
  return { report };
});
