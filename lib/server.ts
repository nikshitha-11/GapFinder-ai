import { createClient } from "@supabase/supabase-js";

// Authenticate each API request using the logged-in user's access token.
async function auth(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(
    "Bearer ",
    ""
  );

  if (!token) {
    throw new Response(
      JSON.stringify({ error: "Please sign in." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data, error } = await sb.auth.getUser(token);

  if (error || !data.user) {
    throw new Response(
      JSON.stringify({ error: "Please sign in again." }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return {
    sb,
    user: data.user,
  };
}

// Wrap API routes with authentication and error handling.
export const wrap =
  (fn: (req: Request, ctx: any) => Promise<any>) =>
  async (req: Request) => {
    try {
      const context = await auth(req);
      const result = await fn(req, context);

      return Response.json(result);
    } catch (e: any) {
      if (e instanceof Response) {
        return e;
      }

      console.error("API error:", e);

      return Response.json(
        {
          error: e?.message || "An unexpected error occurred.",
        },
        { status: 500 }
      );
    }
  };

// Retrieval-quality thresholds.
export const MIN_TOPIC_SIM = 0.35;
export const MIN_CHAT_SIM = 0.4;

export const level = (p: number) =>
  p < 0.4 ? "weak" : p <= 0.7 ? "medium" : "strong";