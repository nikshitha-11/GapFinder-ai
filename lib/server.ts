import { createClient } from "@supabase/supabase-js";

// Every API route runs as the logged-in user, so Postgres RLS enforces per-user data isolation.
async function auth(req: Request) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Response(JSON.stringify({ error: "Please sign in." }), { status: 401 });
  return { sb, user: data.user };
}

export const wrap = (fn: (req: Request, ctx: any) => Promise<any>) => async (req: Request) => {
  try { return Response.json(await fn(req, await auth(req))); }
  catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
};

// Retrieval-quality guards (tune with `npm run eval`)
export const MIN_TOPIC_SIM = 0.35;   // topic needs a chunk at least this similar, else it is reported as "not enough material"
export const MIN_CHAT_SIM = 0.4;     // assistant refuses below this
export const level = (p: number) => (p < 0.4 ? "weak" : p <= 0.7 ? "medium" : "strong");
