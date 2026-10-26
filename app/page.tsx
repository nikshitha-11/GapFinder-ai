
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function api(path: string, body?: any, form?: FormData) {
  const { data, error } = await sb.auth.getSession();

  if (error || !data.session) {
    throw new Error("Please sign in to continue.");
  }

  const r = await fetch(path, {
    method: body || form ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(form ? {} : { "Content-Type": "application/json" }),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  const text = await r.text();
  let j: any = null;

  try {
    j = JSON.parse(text);
  } catch {
    // The response was not JSON.
  }

  if (!r.ok) {
    if (j?.error) throw new Error(j.error);

    if (r.status === 504 || /timeout|error occurred/i.test(text)) {
      throw new Error(
        "The server took too long. Please try again in a minute."
      );
    }

    throw new Error(r.statusText || "Something went wrong.");
  }

  if (j === null) {
    throw new Error("Unexpected response from the server.");
  }

  return j;
}

/* ---------- shared UI ---------- */

const tone: Record<string, string> = {
  weak: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  strong: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const bar: Record<string, string> = {
  weak: "bg-rose-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
};

const Badge = ({ l }: { l: string }) => (
  <span
    className={`ring-1 ring-inset rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
      tone[l] || "bg-slate-50 text-slate-700 ring-slate-200"
    }`}
  >
    {l}
  </span>
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="fade-up bg-white/80 backdrop-blur ring-1 ring-slate-200/70 shadow-sm rounded-2xl p-5 mb-4 hover:shadow-md transition-shadow">
    {children}
  </div>
);

const Btn = ({ busy, ...p }: any) => (
  <button
    {...p}
    disabled={busy || p.disabled}
    className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm shadow-teal-600/30 hover:from-teal-700 hover:to-emerald-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {busy && (
      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
    )}
    {p.children}
  </button>
);

/* ---------- login and signup ---------- */

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (m: "in" | "up") => {
    setMode(m);
    setErr("");
    setInfo("");
    setPw("");
    setPw2("");
  };

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setInfo("");

    if (mode === "up") {
      if (!name.trim()) {
        setErr("Please enter your name.");
        return;
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setErr("Enter a valid email address.");
        return;
      }

      if (pw.length < 8) {
        setErr("Password must be at least 8 characters.");
        return;
      }

      if (pw !== pw2) {
        setErr("Passwords do not match.");
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password: pw,
        });

        if (error) setErr(error.message);
      } else {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password: pw,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (error) {
          setErr(error.message);
        } else if (!data.session) {
          setMode("in");
          setPw("");
          setPw2("");
          setInfo(
            "Account created. Check your email to confirm, then sign in."
          );
        } else {
          setInfo("Account created successfully.");
        }
      }
    } catch {
      setErr("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-teal-50 via-white to-indigo-50">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-3xl shadow-xl ring-1 ring-slate-200 p-7 sm:p-9">
        <div className="mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white text-2xl shadow-lg mb-4">
            🎯
          </div>

          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-700 to-indigo-700 bg-clip-text text-transparent">
            GapFinder AI
          </h1>

          <p className="text-slate-600 mt-2">
            Upload your material. Find out what you don't know yet.
          </p>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => switchMode("in")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              mode === "in"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={() => switchMode("up")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              mode === "up"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={go} className="space-y-3">
          {mode === "up" && (
            <input
              aria-label="Full name"
              autoComplete="name"
              placeholder="Full name"
              required
              className="border border-slate-300 rounded-xl w-full p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            aria-label="Email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            required
            className="border border-slate-300 rounded-xl w-full p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            aria-label="Password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            placeholder="Password"
            required
            className="border border-slate-300 rounded-xl w-full p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          {mode === "up" && (
            <input
              aria-label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              required
              className="border border-slate-300 rounded-xl w-full p-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          )}

          {err && (
            <p className="text-red-700 text-sm" role="alert">
              {err}
            </p>
          )}

          {info && (
            <p className="text-emerald-700 text-sm" role="status">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl px-5 py-3 font-semibold shadow-sm hover:from-teal-700 hover:to-emerald-700 transition disabled:opacity-50"
          >
            {busy && (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "in" && (
          <p className="text-xs text-slate-500 mt-6 leading-relaxed">
            Demo account: <b>demo@gapfinder.app</b>
            <br />
            Use the demo credentials configured for your project.
            <br />
            <button
              type="button"
              className="underline mt-1"
              onClick={() => {
                setEmail("demo@gapfinder.app");
                setPw("");
                setErr("");
                setInfo("Enter the demo password configured for your project.");
              }}
            >
              Use demo email
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

/* ---------- material ---------- */

function Material() {
  const [docs, setDocs] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [kind, setKind] = useState("notes");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");

    try {
      const {
        data: { user },
        error: authError,
      } = await sb.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setDocs([]);
        setTopics([]);
        setMsg("Please sign in to view your material.");
        return;
      }

      const [documentsResult, topicsResult] = await Promise.all([
        sb
          .from("documents")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        sb
          .from("topics")
          .select("*")
          .eq("user_id", user.id),
      ]);

      if (documentsResult.error) throw documentsResult.error;
      if (topicsResult.error) throw topicsResult.error;

      setDocs(documentsResult.data || []);
      setTopics(topicsResult.data || []);
    } catch (error: any) {
      setDocs([]);
      setTopics([]);
      setMsg(
        `Unable to load your material: ${error?.message || "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const up = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const f = input.files?.[0];

    if (!f) return;

    setBusy(true);
    setMsg("Reading, chunking and embedding. This can take a minute.");

    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", kind);

      const r = await api("/api/ingest", undefined, fd);

      setMsg(
        `Added ${f.name}: ${r.chunks} chunks${
          r.topics ? `, ${r.topics} topics mapped` : ""
        }.`
      );

      await load();
    } catch (error: any) {
      setMsg(error?.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this document? This cannot be undone.")) {
      return;
    }

    setMsg("");

    try {
      const {
        data: { user },
        error: authError,
      } = await sb.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error } = await sb
        .from("documents")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      await load();
      setMsg("Document deleted if it belonged to your account.");
    } catch (error: any) {
      setMsg(`Could not delete document: ${error?.message || "Unknown error"}`);
    }
  };

  return (
    <div>
      <Card>
        <h2 className="font-semibold mb-2">Add material</h2>
        <p className="text-sm text-slate-600 mb-4">
          Start with your syllabus so topics can be mapped, then add notes and
          past papers (PDF, TXT or MD).
        </p>

        <div className="flex gap-3 items-center flex-wrap">
          <select
            aria-label="Document type"
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="syllabus">Syllabus</option>
            <option value="notes">Notes / textbook</option>
            <option value="past_paper">Past paper</option>
          </select>

          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={up}
            disabled={busy}
            className="text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:text-teal-700 file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-teal-100 file:cursor-pointer"
          />
        </div>

        {busy && (
          <p className="text-sm mt-3 text-slate-600" role="status">
            Uploading and processing your material…
          </p>
        )}

        {msg && (
          <p
            className="text-sm mt-3 text-slate-700 bg-slate-50 rounded-lg px-3 py-2 break-words"
            role="status"
          >
            {msg}
          </p>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">📄 Your documents</h3>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs text-teal-700 hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <p className="text-sm text-slate-500">Loading your documents…</p>
          )}

          {!loading && !docs.length && (
            <p className="text-sm text-slate-500">
              No documents found for this account. Upload a file to get
              started.
            </p>
          )}

          {docs.map((d) => (
            <div
              key={d.id}
              className="flex justify-between items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0"
            >
              <span className="min-w-0 break-words">
                {d.name}
                <span className="ml-1 rounded-full bg-slate-100 text-slate-600 text-xs px-2 py-0.5">
                  {d.kind}
                </span>
              </span>

              <button
                type="button"
                className="text-rose-600 hover:underline shrink-0"
                onClick={() => void del(d.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">🗺️ Topic map</h3>

          {loading && (
            <p className="text-sm text-slate-500">Loading topics…</p>
          )}

          {!loading && !topics.length && (
            <p className="text-sm text-slate-500">
              No topics found. Upload a syllabus to build your topic map.
            </p>
          )}

          {topics.map((t) => (
            <div
              key={t.id}
              className="text-sm py-2 border-b border-slate-100 last:border-0"
            >
              <b>{t.name}</b>
              <div className="text-slate-600">{t.description}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ---------- quiz ---------- */

function Quiz({ onDone }: { onDone: () => void }) {
  const [qs, setQs] = useState<any[]>([]);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [skipped, setSkipped] = useState<string[]>([]);

  const start = async () => {
    setBusy(true);
    setErr("");
    setRes(null);
    setPick({});
    setQs([]);

    try {
      const r = await api("/api/quiz", { perTopic: 2 });
      setQs(r.questions || []);
      setSkipped(r.skipped || []);
    } catch (error: any) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setErr("");

    try {
      setRes(
        await api("/api/submit", {
          answers: qs.map((q) => ({
            question_id: q.id,
            chosen: pick[q.id] ?? -1,
          })),
        })
      );
      onDone();
    } catch (error: any) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const r = (id: string) =>
    res?.results?.find((x: any) => x.question_id === id);

  return (
    <div>
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <Btn busy={busy} onClick={start}>
            {qs.length ? "New diagnostic quiz" : "Start diagnostic quiz"}
          </Btn>
          <span className="text-sm text-slate-600">
            Questions are written from your own notes. Each shows its source.
          </span>
        </div>

        {busy && (
          <p className="text-sm mt-3 text-slate-700" role="status">
            Working. Retrieving passages and writing questions can take up to
            a minute.
          </p>
        )}

        {err && <p className="text-sm mt-3 text-rose-700">{err}</p>}

        {!!skipped.length && (
          <p className="text-sm mt-3 text-amber-800">
            Not enough material to quiz: {skipped.join(", ")}.
          </p>
        )}
      </Card>

      {qs.map((q, i) => (
        <Card key={q.id}>
          <div className="text-xs font-medium text-teal-700 mb-1">
            {q.topics?.name}
          </div>

          <p className="font-medium mb-3">
            {i + 1}. {q.question}
          </p>

          {q.options.map((o: string, k: number) => {
            const rr = r(q.id);

            const cls = rr
              ? k === rr.correct
                ? "border-emerald-500 bg-emerald-50"
                : k === rr.chosen
                ? "border-rose-400 bg-rose-50"
                : ""
              : pick[q.id] === k
              ? "border-teal-500 bg-teal-50"
              : "";

            return (
              <label
                key={k}
                className={`flex gap-3 items-center border border-slate-200 rounded-xl p-3 mb-2 text-sm cursor-pointer hover:bg-slate-50 transition ${cls}`}
              >
                <input
                  type="radio"
                  className="accent-teal-600"
                  name={q.id}
                  disabled={!!res}
                  checked={pick[q.id] === k}
                  onChange={() => setPick({ ...pick, [q.id]: k })}
                />
                {o}
              </label>
            );
          })}

          {r(q.id) && (
            <div className="text-sm mt-3">
              <b
                className={
                  r(q.id).is_correct ? "text-emerald-700" : "text-rose-700"
                }
              >
                {r(q.id).is_correct ? "Correct." : "Not quite."}
              </b>{" "}
              {r(q.id).explanation}

              {r(q.id).why_wrong && (
                <div className="text-rose-800 mt-1">
                  Why your answer was wrong: {r(q.id).why_wrong}
                </div>
              )}
            </div>
          )}

          <details className="text-xs text-slate-600 mt-3">
            <summary className="cursor-pointer">
              Source: {q.chunks?.documents?.name}, p.{q.chunks?.page}
            </summary>
            <p className="mt-1 italic">{q.chunks?.content?.slice(0, 400)}</p>
          </details>
        </Card>
      ))}

      {qs.length > 0 && !res && (
        <Btn busy={busy} onClick={submit}>
          Submit answers
        </Btn>
      )}

      {res && (
        <Card>
          <p className="font-semibold">
            🎉 Score: {res.score} / {res.total}. Open the Gap report tab to see
            where you stand.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ---------- report ---------- */

function Report() {
  const [rep, setRep] = useState<any>(null);
  const [h, setH] = useState(2);
  const [d, setD] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/report")
      .then((r) => setRep(r.report))
      .catch((error) => setErr(error.message));
  }, []);

  const build = async () => {
    setBusy(true);
    setErr("");

    try {
      setRep(
        (await api("/api/report", { hoursPerDay: h, days: d })).report
      );
    } catch (error: any) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    "border border-slate-300 rounded-xl px-3 py-2 w-28 block mt-1 focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div>
      <Card>
        <div className="flex items-end gap-4 flex-wrap">
          <label className="text-sm text-slate-700">
            Hours per day
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={h}
              onChange={(e) => setH(+e.target.value)}
              className={field}
            />
          </label>

          <label className="text-sm text-slate-700">
            Days until exam
            <input
              type="number"
              min={1}
              value={d}
              onChange={(e) => setD(+e.target.value)}
              className={field}
            />
          </label>

          <Btn busy={busy} onClick={build}>
            Build gap report and plan
          </Btn>
        </div>

        {err && <p className="text-sm mt-3 text-rose-700">{err}</p>}
      </Card>

      {rep && (
        <>
          <h2 className="font-semibold mb-3 mt-6">
            Gap report{" "}
            <span className="text-sm font-normal text-slate-500">
              weak under 40%, medium 40–70%, strong over 70%
            </span>
          </h2>

          {rep.gaps?.map((g: any) => (
            <Card key={g.topic}>
              <div className="flex justify-between items-center gap-3">
                <b>{g.topic}</b>
                <span className="flex gap-2 items-center text-sm text-slate-600">
                  {g.right}/{g.total} ({g.pct}%) <Badge l={g.level} />
                </span>
              </div>

              <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    bar[g.level] || "bg-slate-400"
                  }`}
                  style={{ width: `${g.pct}%` }}
                />
              </div>

              <p className="text-sm text-slate-700 mt-2">{g.reason}</p>
            </Card>
          ))}

          <h2 className="font-semibold mt-8 mb-3">
            Revision plan: {rep.hoursPerDay} h/day, {rep.days} days
          </h2>

          {rep.plan?.map((p: any) => (
            <Card key={p.day}>
              <b className="text-sm text-teal-700">Day {p.day}</b>

              {p.sessions.map((s: any, i: number) => (
                <div key={i} className="mt-3 text-sm">
                  <div className="flex gap-2 items-center flex-wrap">
                    <b>{s.topic}</b>
                    <Badge l={s.level} />
                    <span className="text-slate-500">{s.minutes} min</span>
                  </div>

                  <ul className="list-disc ml-5 mt-1 text-slate-700">
                    {s.tasks.map((t: string, k: number) => (
                      <li key={k}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- assistant ---------- */

function Assistant() {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    if (!q.trim()) return;

    const qq = q;
    setQ("");
    setBusy(true);

    try {
      const r = await api("/api/chat", { question: qq });
      setLog((previous) => [{ q: qq, ...r }, ...previous]);
    } catch (error: any) {
      setLog((previous) => [
        { q: qq, answer: error.message, citations: [] },
        ...previous,
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Card>
        <div className="flex gap-3">
          <input
            aria-label="Question"
            className="border border-slate-300 rounded-xl px-3 py-2.5 flex-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ask about a topic from your material"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void ask();
            }}
          />

          <Btn busy={busy} onClick={ask}>
            Explain
          </Btn>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Answers use only your uploaded material. If it is not there, the
          assistant says so.
        </p>
      </Card>

      {log.map((m, i) => (
        <Card key={i}>
          <p className="font-medium text-sm text-teal-800">{m.q}</p>
          <p className="text-sm mt-2 whitespace-pre-wrap text-slate-800">
            {m.answer}
          </p>

          {m.citations?.map((c: any) => (
            <details key={c.n} className="text-xs text-slate-600 mt-2">
              <summary className="cursor-pointer">
                [{c.n}] {c.doc}, p.{c.page}
              </summary>
              <p className="italic mt-1">{c.snippet}...</p>
            </details>
          ))}
        </Card>
      ))}
    </div>
  );
}

/* ---------- progress ---------- */

function Progress() {
  const [a, setA] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/dashboard")
      .then((r) => setA(r.attempts || []))
      .catch((error) => setErr(error.message));
  }, []);

  if (err) {
    return (
      <Card>
        <p className="text-sm text-rose-700">{err}</p>
      </Card>
    );
  }

  if (!a.length) {
    return (
      <Card>
        <p className="text-sm text-slate-600">
          No attempts yet. Take a quiz to start tracking progress.
        </p>
      </Card>
    );
  }

  const W = 560;
  const H = 160;
  const x = (i: number) =>
    a.length === 1 ? W / 2 : 30 + (i * (W - 60)) / (a.length - 1);
  const y = (p: number) => H - 20 - (p * (H - 40)) / 100;

  const topics = [...new Set(a.flatMap((t) => Object.keys(t.byTopic || {})))];

  const cell = (v: number | undefined) =>
    v == null
      ? "text-slate-400"
      : v < 40
      ? "text-rose-700 font-semibold"
      : v <= 70
      ? "text-amber-700 font-semibold"
      : "text-emerald-700 font-semibold";

  return (
    <div>
      <Card>
        <h3 className="font-semibold mb-2">Score per attempt</h3>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-xl"
          role="img"
          aria-label="Score per attempt"
        >
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line
                x1="30"
                x2={W - 20}
                y1={y(g)}
                y2={y(g)}
                stroke="#e2e8f0"
              />
              <text x="2" y={y(g) + 4} fontSize="10" fill="#64748b">
                {g}%
              </text>
            </g>
          ))}

          <polyline
            fill="none"
            stroke="#0f766e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            points={a.map((t, i) => `${x(i)},${y(t.pct)}`).join(" ")}
          />

          {a.map((t, i) => (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(t.pct)}
                r="4.5"
                fill="#fff"
                stroke="#0f766e"
                strokeWidth="2"
              />
              <text
                x={x(i)}
                y={y(t.pct) - 9}
                fontSize="10"
                textAnchor="middle"
              >
                {t.pct}%
              </text>
              <text
                x={x(i)}
                y={H - 4}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                #{t.n}
              </text>
            </g>
          ))}
        </svg>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Topic strength by attempt</h3>

        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-1.5">Topic</th>
                {a.map((t) => (
                  <th key={t.n}>#{t.n}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {topics.map((tp) => (
                <tr key={tp} className="border-t border-slate-100">
                  <td className="py-1.5">{tp}</td>
                  {a.map((t) => (
                    <td key={t.n} className={cell(t.byTopic?.[tp])}>
                      {t.byTopic?.[tp] != null ? `${t.byTopic[tp]}%` : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-sm text-slate-600">
        After each new attempt, rebuild the gap report to refresh your plan.
      </p>
    </div>
  );
}

/* ---------- application shell ---------- */

export default function Home() {
  const [ses, setSes] = useState<any>(undefined);
  const [tab, setTab] = useState("material");
  const [k, setK] = useState(0);

  useEffect(() => {
    let alive = true;

    sb.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      setSes(error ? null : data.session);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setSes(session);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  if (ses === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-indigo-50 px-4">
        <div className="text-center">
          <div className="text-3xl mb-3">🎯</div>
          <h1 className="text-2xl font-bold text-teal-800">GapFinder AI</h1>
          <p className="text-sm text-slate-500 mt-2">
            Checking your sign-in…
          </p>
        </div>
      </main>
    );
  }

  if (!ses) return <Login />;

  const tabs = [
    ["material", "📚", "Material"],
    ["quiz", "📝", "Diagnostic quiz"],
    ["report", "📊", "Gap report and plan"],
    ["assistant", "💬", "Explain a topic"],
    ["progress", "📈", "Progress"],
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <header className="flex justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-indigo-700 bg-clip-text text-transparent">
              🎯 GapFinder AI
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Your personal learning workspace
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500 max-w-40 truncate">
              {ses.user.email}
            </span>
            <button
              type="button"
              className="text-sm text-slate-600 bg-white ring-1 ring-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50"
              onClick={() => void sb.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800">
            Welcome back!
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Upload your study material, identify knowledge gaps, and plan your
            revision.
          </p>
        </section>

        <nav
          className="flex gap-1.5 mb-6 p-1.5 bg-white/80 backdrop-blur ring-1 ring-slate-200 rounded-2xl overflow-x-auto shadow-sm"
          aria-label="Sections"
        >
          {tabs.map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition ${
                tab === id
                  ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </nav>

        {tab === "material" && <Material />}
        {tab === "quiz" && (
          <Quiz onDone={() => setK((previous) => previous + 1)} />
        )}
        {tab === "report" && <Report key={k} />}
        {tab === "assistant" && <Assistant />}
        {tab === "progress" && <Progress key={k} />}
      </div>
    </main>
  );
}
