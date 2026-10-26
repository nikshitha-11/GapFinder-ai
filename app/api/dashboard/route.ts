import { wrap } from "@/lib/server";

// Per-attempt overall % and per-topic % so the UI can show improvement.
export const GET = wrap(async (_r, { sb }) => {
  const { data: atts } = await sb.from("attempts").select("id,score,total,created_at").order("created_at");
  const { data: ans } = await sb.from("answers").select("attempt_id,is_correct,topics(name)");
  const attempts = (atts || []).map((a: any, i: number) => {
    const by: Record<string, { r: number; t: number }> = {};
    for (const x of (ans || []).filter((x: any) => x.attempt_id === a.id)) {
      const k = x.topics.name; by[k] = by[k] || { r: 0, t: 0 }; by[k].t++; if (x.is_correct) by[k].r++;
    }
    return { n: i + 1, date: a.created_at, pct: Math.round((a.score / a.total) * 100), byTopic: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round((v.r / v.t) * 100)])) };
  });
  return { attempts };
});
