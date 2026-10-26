// Creates the demo user and loads the sample material. Run once after setting .env.local: npm run seed
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { ingest, textToPages } from "../lib/ingest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const email = process.env.DEMO_EMAIL || "demo@gapfinder.app", password = process.env.DEMO_PASSWORD || "Demo@12345";

(async () => {
  const sb = createClient(url, anon);
  const su = await sb.auth.signUp({ email, password });
  if (su.error && !/already|registered/i.test(su.error.message)) throw su.error;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const uid = data.user.id;
  await sb.from("documents").delete().eq("user_id", uid);
  for (const [file, kind] of [["syllabus", "syllabus"], ["notes", "notes"], ["past_paper", "past_paper"]]) {
    const r = await ingest(sb, uid, `${file}.txt`, kind, textToPages(readFileSync(`scripts/sample/${file}.txt`, "utf8")));
    console.log(file, r);
  }
  console.log(`Done. Login: ${email} / ${password}`);
})().catch((e) => { console.error(e); process.exit(1); });
