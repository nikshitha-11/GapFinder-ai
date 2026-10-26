// Retrieval check: does the top-3 for each question contain the expected fact? Prints hit rate for the docs.
import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/ai";
const cases: [string, string][] = [
  ["Why can displacement be zero when distance is not?", "shortest straight-line"],
  ["What is the common velocity after a perfectly inelastic collision?", "m1 u1 + m2 u2"],
  ["Why does an airbag reduce injury?", "contact time"],
  ["What provides centripetal force for a car on a flat road?", "friction provides"],
  ["Is friction dependent on contact area?", "not on the contact area"],
  ["Why does centripetal force do no work?", "perpendicular"],
  ["How do you find the speed of a dropped ball at the ground?", "sqrt(2gh)"],
  ["What is the work-energy theorem?", "change in kinetic energy"],
  ["Which launch angle gives maximum range?", "45 degrees"],
  ["Do action and reaction forces cancel?", "different bodies"],
];
(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  await sb.auth.signInWithPassword({ email: process.env.DEMO_EMAIL || "demo@gapfinder.app", password: process.env.DEMO_PASSWORD || "Demo@12345" });
  let hit = 0;
  for (const [q, needle] of cases) {
    const [e] = await embed([q]);
    const { data } = await sb.rpc("match_chunks", { query_embedding: e, match_count: 3, only_kinds: null });
    const ok = data?.some((h: any) => h.content.includes(needle)); if (ok) hit++;
    console.log(ok ? "HIT " : "MISS", (data?.[0]?.similarity ?? 0).toFixed(2), q);
  }
  console.log(`Top-3 hit rate: ${hit}/${cases.length}`);
})();
