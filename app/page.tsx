"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
async function api(path: string, body?: any, form?: FormData) {
  const { data } = await sb.auth.getSession();
  const r = await fetch(path, {
    method: body || form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${data.session?.access_token}`, ...(form ? {} : { "Content-Type": "application/json" }) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) {
    if (j?.error) throw new Error(j.error);
    if (r.status === 504 || /timeout|error occurred/i.test(text)) throw new Error("The server took too long. Please try again in a minute.");
    throw new Error(r.statusText || "Something went wrong. Please try again.");
  }
  if (j === null) throw new Error("Unexpected response from the server.");
  return j;
}

/* ---------- shared UI ---------- */
const tone: Record<string, string> = {
  weak: "bg-rose-50 text-rose-700 ring-rose-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  strong: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};
const bar: Record<string, string> = { weak: "bg-rose-500", medium: "bg-amber-500", strong: "bg-emerald-500" };
const Badge = ({ l }: { l: string }) => (
  <span className={`ring-1 ring-inset rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone[l]}`}>{l}</span>
);
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="fade-up bg-white/80 backdrop-blur ring-1 ring-slate-200/70 shadow-sm rounded-2xl p-5 mb-4 hover:shadow-md transition-shadow">{children}</div>
);
const Btn = ({ busy, ...p }: any) => (
  <button
    {...p}
    disabled={busy || p.disabled}
    className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm shadow-teal-600/30 hover:from-teal-700 hover:to-emerald-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {busy && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
    {p.children}
  </button>
);

/* ---------- login ---------- */
function Login() {
  const [email, setEmail] = useState("demo@gapfinder.app"), [pw, setPw] = useState("Demo@12345"), [err, setErr] = useState(""), [mode, setMode] = useState("in");
  const go = async () => {
    setErr("");
    const { error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw });
    if (error) setErr(error.message);
  };
  const input = "border border-slate-300 rounded-xl w-full px-3 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";
  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <section className="hidden md:flex flex-col justify-center px-14 text-white bg-gradient-to-br from-teal-700 via-teal-800 to-indigo-900">
        <div className="text-5xl mb-5">🎯</div>
        <h1 className="text-4xl font-bold leading-tight mb-4">Find what you<br />don&apos;t know yet.</h1>
        <p className="text-teal-100 max-w-md mb-6">Upload your syllabus and notes. GapFinder quizzes you from your own material, shows your weak spots, and builds a revision plan.</p>
        <ul className="space-y-2 text-sm text-teal-50">
          <li>✓ Questions written from your own notes</li>
          <li>✓ Every answer shows its source page</li>
          <li>✓ Day-by-day plan, weakest topics first</li>
        </ul>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="fade-up w-full max-w-sm bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-7">
          <h2 className="text-2xl font-bold mb-1">{mode === "in" ? "Welcome back" : "Create your account"}</h2>
          <p className="text-slate-600 text-sm mb-6">Upload your material. Find out what you don&apos;t know yet.</p>
          <input aria-label="Email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input aria-label="Password" type="password" className={input} value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-rose-700 text-sm mb-3">{err}</p>}
          <Btn onClick={go}>{mode === "in" ? "Sign in" : "Create account"}</Btn>
          <button className="block text-sm text-teal-700 mt-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create account" : "Have an account? Sign in"}
          </button>
          <p className="text-xs text-slate-500 mt-6">Demo login is prefilled and has sample physics material loaded.</p>
        </div>
      </section>
    </main>
  );
}

/* ---------- material ---------- */
function Material() {
  const [docs, setDocs] = useState<any[]>([]), [topics, setTopics] = useState<any[]>([]), [kind, setKind] = useState("notes"), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const load = async () => { setDocs((await sb.from("documents").select("*").order("created_at")).data || []); setTopics((await sb.from("topics").select("*")).data || []); };
  useEffect(() => { load(); }, []);
  const up = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setMsg("Reading, chunking and embedding. This can take a minute.");
    const fd = new FormData(); fd.append("file", f); fd.append("kind", kind);
    try { const r = await api("/api/ingest", undefined, fd); setMsg(`Added ${f.name}: ${r.chunks} chunks${r.topics ? `, ${r.topics} topics mapped` : ""}.`); await load(); }
    catch (x: any) { setMsg(x.message); }
    setBusy(false); e.target.value = "";
  };
  const del = async (id: string) => { await sb.from("documents").delete().eq("id", id); load(); };
  return (<div>
    <Card>
      <h2 className="font-semibold mb-2">Add material</h2>
      <p className="text-sm text-slate-600 mb-4">Start with your syllabus so topics can be mapped, then add notes and past papers (PDF, TXT or MD).</p>
      <div className="flex gap-3 items-center flex-wrap">
        <select aria-label="Document type" className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="syllabus">Syllabus</option><option value="notes">Notes / textbook</option><option value="past_paper">Past paper</option>
        </select>
        <input type="file" accept=".pdf,.txt,.md" onChange={up} disabled={busy}
          className="text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:text-teal-700 file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-teal-100 file:cursor-pointer" />
      </div>
      {msg && <p className="text-sm mt-3 text-slate-700 bg-slate-50 rounded-lg px-3 py-2" role="status">{msg}</p>}
    </Card>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><h3 className="font-semibold mb-2">📄 Your documents</h3>
        {!docs.length && <p className="text-sm text-slate-500">Nothing uploaded yet.</p>}
        {docs.map((d) => <div key={d.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 last:border-0"><span>{d.name} <span className="ml-1 rounded-full bg-slate-100 text-slate-600 text-xs px-2 py-0.5">{d.kind}</span></span><button className="text-rose-600 hover:underline" onClick={() => del(d.id)}>Delete</button></div>)}
      </Card>
      <Card><h3 className="font-semibold mb-2">🗺️ Topic map</h3>
        {!topics.length && <p className="text-sm text-slate-500">Upload a syllabus to build the topic map.</p>}
        {topics.map((t) => <div key={t.id} className="text-sm py-2 border-b border-slate-100 last:border-0"><b>{t.name}</b><div className="text-slate-600">{t.description}</div></div>)}
      </Card>
    </div>
  </div>);
}

/* ---------- quiz ---------- */
function Quiz({ onDone }: { onDone: () => void }) {
  const [qs, setQs] = useState<any[]>([]), [pick, setPick] = useState<Record<string, number>>({}), [res, setRes] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [skipped, setSkipped] = useState<string[]>([]);
  const start = async () => { setBusy(true); setErr(""); setRes(null); setPick({}); try { const r = await api("/api/quiz", { perTopic: 2 }); setQs(r.questions); setSkipped(r.skipped); } catch (x: any) { setErr(x.message); } setBusy(false); };
  const submit = async () => { setBusy(true); try { setRes(await api("/api/submit", { answers: qs.map((q) => ({ question_id: q.id, chosen: pick[q.id] ?? -1 })) })); onDone(); } catch (x: any) { setErr(x.message); } setBusy(false); };
  const r = (id: string) => res?.results.find((x: any) => x.question_id === id);
  return (<div>
    <Card><div className="flex items-center gap-4 flex-wrap"><Btn busy={busy} onClick={start}>{qs.length ? "New diagnostic quiz" : "Start diagnostic quiz"}</Btn>
      <span className="text-sm text-slate-600">Questions are written from your own notes. Each shows its source.</span></div>
      {busy && <p className="text-sm mt-3 text-slate-700" role="status">Working. Retrieving passages and writing questions can take up to a minute.</p>}
      {err && <p className="text-sm mt-3 text-rose-700">{err}</p>}
      {!!skipped.length && <p className="text-sm mt-3 text-amber-800">Not enough material to quiz: {skipped.join(", ")}.</p>}
    </Card>
    {qs.map((q, i) => (<Card key={q.id}>
      <div className="text-xs font-medium text-teal-700 mb-1">{q.topics.name}</div>
      <p className="font-medium mb-3">{i + 1}. {q.question}</p>
      {q.options.map((o: string, k: number) => {
        const rr = r(q.id); const cls = rr ? (k === rr.correct ? "border-emerald-500 bg-emerald-50" : k === rr.chosen ? "border-rose-400 bg-rose-50" : "") : pick[q.id] === k ? "border-teal-500 bg-teal-50" : "";
        return <label key={k} className={`flex gap-3 items-center border border-slate-200 rounded-xl p-3 mb-2 text-sm cursor-pointer hover:bg-slate-50 transition ${cls}`}><input type="radio" className="accent-teal-600" name={q.id} disabled={!!res} checked={pick[q.id] === k} onChange={() => setPick({ ...pick, [q.id]: k })} />{o}</label>;
      })}
      {r(q.id) && <div className="text-sm mt-3"><b className={r(q.id).is_correct ? "text-emerald-700" : "text-rose-700"}>{r(q.id).is_correct ? "Correct." : "Not quite."}</b> {r(q.id).explanation}{r(q.id).why_wrong && <div className="text-rose-800 mt-1">Why your answer was wrong: {r(q.id).why_wrong}</div>}</div>}
      <details className="text-xs text-slate-600 mt-3"><summary className="cursor-pointer">Source: {q.chunks?.documents?.name}, p.{q.chunks?.page}</summary><p className="mt-1 italic">{q.chunks?.content?.slice(0, 400)}</p></details>
    </Card>))}
    {qs.length > 0 && !res && <Btn busy={busy} onClick={submit}>Submit answers</Btn>}
    {res && <Card><p className="font-semibold">🎉 Score: {res.score} / {res.total}. Open the Gap report tab to see where you stand.</p></Card>}
  </div>);
}

/* ---------- report ---------- */
function Report() {
  const [rep, setRep] = useState<any>(null), [h, setH] = useState(2), [d, setD] = useState(7), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { api("/api/report").then((r) => setRep(r.report)).catch(() => {}); }, []);
  const build = async () => { setBusy(true); setErr(""); try { setRep((await api("/api/report", { hoursPerDay: h, days: d })).report); } catch (x: any) { setErr(x.message); } setBusy(false); };
  const field = "border border-slate-300 rounded-xl px-3 py-2 w-28 block mt-1 focus:outline-none focus:ring-2 focus:ring-teal-500";
  return (<div>
    <Card><div className="flex items-end gap-4 flex-wrap">
      <label className="text-sm text-slate-700">Hours per day<input type="number" min={0.5} step={0.5} value={h} onChange={(e) => setH(+e.target.value)} className={field} /></label>
      <label className="text-sm text-slate-700">Days until exam<input type="number" min={1} value={d} onChange={(e) => setD(+e.target.value)} className={field} /></label>
      <Btn busy={busy} onClick={build}>Build gap report and plan</Btn></div>
      {err && <p className="text-sm mt-3 text-rose-700">{err}</p>}</Card>
    {rep && <>
      <h2 className="font-semibold mb-3 mt-6">Gap report <span className="text-sm font-normal text-slate-500">weak under 40%, medium 40-70%, strong over 70%</span></h2>
      {rep.gaps.map((g: any) => (
        <Card key={g.topic}>
          <div className="flex justify-between items-center">
            <b>{g.topic}</b>
            <span className="flex gap-2 items-center text-sm text-slate-600">{g.right}/{g.total} ({g.pct}%) <Badge l={g.level} /></span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className={`h-full rounded-full ${bar[g.level]}`} style={{ width: `${g.pct}%` }} />
          </div>
          <p className="text-sm text-slate-700 mt-2">{g.reason}</p>
        </Card>
      ))}
      <h2 className="font-semibold mt-8 mb-3">Revision plan: {rep.hoursPerDay} h/day, {rep.days} days</h2>
      {rep.plan.map((p: any) => <Card key={p.day}><b className="text-sm text-teal-700">Day {p.day}</b>{p.sessions.map((s: any, i: number) => <div key={i} className="mt-3 text-sm"><div className="flex gap-2 items-center"><b>{s.topic}</b><Badge l={s.level} /><span className="text-slate-500">{s.minutes} min</span></div><ul className="list-disc ml-5 mt-1 text-slate-700">{s.tasks.map((t: string, k: number) => <li key={k}>{t}</li>)}</ul></div>)}</Card>)}
    </>}
  </div>);
}

/* ---------- assistant ---------- */
function Assistant() {
  const [q, setQ] = useState(""), [log, setLog] = useState<any[]>([]), [busy, setBusy] = useState(false);
  const ask = async () => { if (!q.trim()) return; const qq = q; setQ(""); setBusy(true); try { const r = await api("/api/chat", { question: qq }); setLog([{ q: qq, ...r }, ...log]); } catch (x: any) { setLog([{ q: qq, answer: x.message, citations: [] }, ...log]); } setBusy(false); };
  return (<div>
    <Card><div className="flex gap-3"><input aria-label="Question" className="border border-slate-300 rounded-xl px-3 py-2.5 flex-1 focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ask about a topic from your material" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} /><Btn busy={busy} onClick={ask}>Explain</Btn></div>
      <p className="text-xs text-slate-500 mt-3">Answers use only your uploaded material. If it is not there, the assistant says so.</p></Card>
    {log.map((m, i) => <Card key={i}><p className="font-medium text-sm text-teal-800">{m.q}</p><p className="text-sm mt-2 whitespace-pre-wrap text-slate-800">{m.answer}</p>
      {m.citations?.map((c: any) => <details key={c.n} className="text-xs text-slate-600 mt-2"><summary className="cursor-pointer">[{c.n}] {c.doc}, p.{c.page}</summary><p className="italic mt-1">{c.snippet}...</p></details>)}</Card>)}
  </div>);
}

/* ---------- progress ---------- */
function Progress() {
  const [a, setA] = useState<any[]>([]);
  useEffect(() => { api("/api/dashboard").then((r) => setA(r.attempts)).catch(() => {}); }, []);
  if (!a.length) return <Card><p className="text-sm text-slate-600">No attempts yet. Take a quiz to start tracking progress.</p></Card>;
  const W = 560, H = 160, x = (i: number) => (a.length === 1 ? W / 2 : 30 + (i * (W - 60)) / (a.length - 1)), y = (p: number) => H - 20 - (p * (H - 40)) / 100;
  const topics = [...new Set(a.flatMap((t) => Object.keys(t.byTopic)))];
  const cell = (v: number | undefined) => v == null ? "text-slate-400" : v < 40 ? "text-rose-700 font-semibold" : v <= 70 ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold";
  return (<div>
    <Card><h3 className="font-semibold mb-2">Score per attempt</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Score per attempt">
        {[0, 50, 100].map((g) => <g key={g}><line x1="30" x2={W - 20} y1={y(g)} y2={y(g)} stroke="#e2e8f0" /><text x="2" y={y(g) + 4} fontSize="10" fill="#64748b">{g}%</text></g>)}
        <polyline fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" points={a.map((t, i) => `${x(i)},${y(t.pct)}`).join(" ")} />
        {a.map((t, i) => <g key={i}><circle cx={x(i)} cy={y(t.pct)} r="4.5" fill="#fff" stroke="#0f766e" strokeWidth="2" /><text x={x(i)} y={y(t.pct) - 9} fontSize="10" textAnchor="middle">{t.pct}%</text><text x={x(i)} y={H - 4} fontSize="10" textAnchor="middle" fill="#64748b">#{t.n}</text></g>)}
      </svg></Card>
    <Card><h3 className="font-semibold mb-2">Topic strength by attempt</h3>
      <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr className="text-left text-slate-600"><th className="py-1.5">Topic</th>{a.map((t) => <th key={t.n}>#{t.n}</th>)}</tr></thead>
        <tbody>{topics.map((tp) => <tr key={tp} className="border-t border-slate-100"><td className="py-1.5">{tp}</td>{a.map((t) => <td key={t.n} className={cell(t.byTopic[tp])}>{t.byTopic[tp] != null ? `${t.byTopic[tp]}%` : "-"}</td>)}</tr>)}</tbody></table></div></Card>
    <p className="text-sm text-slate-600">After each new attempt, rebuild the gap report to refresh your plan.</p>
  </div>);
}

/* ---------- shell ---------- */
export default function Home() {
  const [ses, setSes] = useState<any>(undefined), [tab, setTab] = useState("material"), [k, setK] = useState(0);
  useEffect(() => { sb.auth.getSession().then(({ data }) => setSes(data.session)); const { data } = sb.auth.onAuthStateChange((_e, s) => setSes(s)); return () => data.subscription.unsubscribe(); }, []);
  if (ses === undefined) return null;
  if (!ses) return <Login />;
  const tabs = [["material", "📚", "Material"], ["quiz", "📝", "Diagnostic quiz"], ["report", "📊", "Gap report and plan"], ["assistant", "💬", "Explain a topic"], ["progress", "📈", "Progress"]];
  return (<main className="max-w-4xl mx-auto px-4 py-6">
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-indigo-700 bg-clip-text text-transparent">🎯 GapFinder AI</h1>
      <button className="text-sm text-slate-600 bg-white ring-1 ring-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50" onClick={() => sb.auth.signOut()}>Sign out ({ses.user.email})</button>
    </header>
    <nav className="flex gap-1.5 mb-6 p-1.5 bg-white/70 backdrop-blur ring-1 ring-slate-200 rounded-2xl overflow-x-auto" aria-label="Sections">
      {tabs.map(([id, icon, l]) => (
        <button key={id} onClick={() => setTab(id)} aria-current={tab === id}
          className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition ${tab === id ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>
          {icon} {l}
        </button>
      ))}
    </nav>
    {tab === "material" && <Material />}{tab === "quiz" && <Quiz onDone={() => setK(k + 1)} />}{tab === "report" && <Report key={k} />}{tab === "assistant" && <Assistant />}{tab === "progress" && <Progress key={k} />}
  </main>);
}