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
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
const tone: Record<string, string> = {
  weak: "bg-red-100 text-red-800 border-red-300", medium: "bg-amber-100 text-amber-800 border-amber-300", strong: "bg-emerald-100 text-emerald-800 border-emerald-300",
};
const Badge = ({ l }: { l: string }) => <span className={`border rounded px-2 py-0.5 text-xs font-medium ${tone[l]}`}>{l}</span>;
const Card = ({ children }: { children: React.ReactNode }) => <div className="bg-white border border-slate-200 rounded-lg p-4 mb-3">{children}</div>;
const Btn = ({ busy, ...p }: any) => <button {...p} disabled={busy || p.disabled} className="bg-accent text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-teal-800" />;

function Login() {
  const [email, setEmail] = useState("demo@gapfinder.app"), [pw, setPw] = useState("Demo@12345"), [err, setErr] = useState(""), [mode, setMode] = useState("in");
  const go = async () => {
    setErr("");
    const { error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw });
    if (error) setErr(error.message);
  };
  return (
    <main className="max-w-sm mx-auto mt-24 px-4">
      <h1 className="text-3xl font-semibold mb-1">GapFinder AI</h1>
      <p className="text-slate-600 mb-6">Upload your material. Find out what you don't know yet.</p>
      <input aria-label="Email" className="border rounded w-full p-2 mb-2" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input aria-label="Password" type="password" className="border rounded w-full p-2 mb-3" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="text-red-700 text-sm mb-2">{err}</p>}
      <Btn onClick={go}>{mode === "in" ? "Sign in" : "Create account"}</Btn>
      <button className="text-sm text-slate-600 ml-3 underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "New here? Create account" : "Have an account? Sign in"}</button>
      <p className="text-xs text-slate-500 mt-6">Demo login is prefilled and has sample physics material loaded.</p>
    </main>
  );
}

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
      <p className="text-sm text-slate-600 mb-3">Start with your syllabus so topics can be mapped, then add notes and past papers (PDF, TXT or MD).</p>
      <div className="flex gap-2 items-center flex-wrap">
        <select aria-label="Document type" className="border rounded p-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="syllabus">Syllabus</option><option value="notes">Notes / textbook</option><option value="past_paper">Past paper</option>
        </select>
        <input type="file" accept=".pdf,.txt,.md" onChange={up} disabled={busy} className="text-sm" />
      </div>
      {msg && <p className="text-sm mt-2 text-slate-700" role="status">{msg}</p>}
    </Card>
    <div className="grid md:grid-cols-2 gap-3">
      <Card><h3 className="font-semibold mb-2">Your documents</h3>
        {!docs.length && <p className="text-sm text-slate-500">Nothing uploaded yet.</p>}
        {docs.map((d) => <div key={d.id} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{d.name} <span className="text-slate-500">({d.kind})</span></span><button className="text-red-700 underline" onClick={() => del(d.id)}>Delete</button></div>)}
      </Card>
      <Card><h3 className="font-semibold mb-2">Topic map</h3>
        {!topics.length && <p className="text-sm text-slate-500">Upload a syllabus to build the topic map.</p>}
        {topics.map((t) => <div key={t.id} className="text-sm py-1"><b>{t.name}</b><div className="text-slate-600">{t.description}</div></div>)}
      </Card>
    </div>
  </div>);
}

function Quiz({ onDone }: { onDone: () => void }) {
  const [qs, setQs] = useState<any[]>([]), [pick, setPick] = useState<Record<string, number>>({}), [res, setRes] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [skipped, setSkipped] = useState<string[]>([]);
  const start = async () => { setBusy(true); setErr(""); setRes(null); setPick({}); try { const r = await api("/api/quiz", { perTopic: 2 }); setQs(r.questions); setSkipped(r.skipped); } catch (x: any) { setErr(x.message); } setBusy(false); };
  const submit = async () => { setBusy(true); try { setRes(await api("/api/submit", { answers: qs.map((q) => ({ question_id: q.id, chosen: pick[q.id] ?? -1 })) })); onDone(); } catch (x: any) { setErr(x.message); } setBusy(false); };
  const r = (id: string) => res?.results.find((x: any) => x.question_id === id);
  return (<div>
    <Card><div className="flex items-center gap-3"><Btn busy={busy} onClick={start}>{qs.length ? "New diagnostic quiz" : "Start diagnostic quiz"}</Btn>
      <span className="text-sm text-slate-600">Questions are written from your own notes. Each shows its source.</span></div>
      {busy && <p className="text-sm mt-2" role="status">Working. Retrieving passages and writing questions can take up to a minute.</p>}
      {err && <p className="text-sm mt-2 text-red-700">{err}</p>}
      {!!skipped.length && <p className="text-sm mt-2 text-amber-800">Not enough material to quiz: {skipped.join(", ")}.</p>}
    </Card>
    {qs.map((q, i) => (<Card key={q.id}>
      <div className="text-xs text-slate-500 mb-1">{q.topics.name}</div>
      <p className="font-medium mb-2">{i + 1}. {q.question}</p>
      {q.options.map((o: string, k: number) => {
        const rr = r(q.id); const cls = rr ? (k === rr.correct ? "border-emerald-500 bg-emerald-50" : k === rr.chosen ? "border-red-400 bg-red-50" : "") : pick[q.id] === k ? "border-accent bg-teal-50" : "";
        return <label key={k} className={`flex gap-2 border rounded p-2 mb-1 text-sm cursor-pointer ${cls}`}><input type="radio" name={q.id} disabled={!!res} checked={pick[q.id] === k} onChange={() => setPick({ ...pick, [q.id]: k })} />{o}</label>;
      })}
      {r(q.id) && <div className="text-sm mt-2"><b>{r(q.id).is_correct ? "Correct." : "Not quite."}</b> {r(q.id).explanation}{r(q.id).why_wrong && <div className="text-red-800 mt-1">Why your answer was wrong: {r(q.id).why_wrong}</div>}</div>}
      <details className="text-xs text-slate-600 mt-2"><summary className="cursor-pointer">Source: {q.chunks?.documents?.name}, p.{q.chunks?.page}</summary><p className="mt-1 italic">{q.chunks?.content?.slice(0, 400)}</p></details>
    </Card>))}
    {qs.length > 0 && !res && <Btn busy={busy} onClick={submit}>Submit answers</Btn>}
    {res && <Card><p className="font-semibold">Score: {res.score} / {res.total}. Open the Gap report tab to see where you stand.</p></Card>}
  </div>);
}

function Report() {
  const [rep, setRep] = useState<any>(null), [h, setH] = useState(2), [d, setD] = useState(7), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { api("/api/report").then((r) => setRep(r.report)).catch(() => {}); }, []);
  const build = async () => { setBusy(true); setErr(""); try { setRep((await api("/api/report", { hoursPerDay: h, days: d })).report); } catch (x: any) { setErr(x.message); } setBusy(false); };
  return (<div>
    <Card><div className="flex items-end gap-3 flex-wrap">
      <label className="text-sm">Hours per day<input type="number" min={0.5} step={0.5} value={h} onChange={(e) => setH(+e.target.value)} className="border rounded p-2 w-24 block" /></label>
      <label className="text-sm">Days until exam<input type="number" min={1} value={d} onChange={(e) => setD(+e.target.value)} className="border rounded p-2 w-24 block" /></label>
      <Btn busy={busy} onClick={build}>Build gap report and plan</Btn></div>
      {err && <p className="text-sm mt-2 text-red-700">{err}</p>}</Card>
    {rep && <>
      <h2 className="font-semibold mb-2">Gap report <span className="text-sm font-normal text-slate-500">weak under 40%, medium 40-70%, strong over 70%</span></h2>
      {rep.gaps.map((g: any) => <Card key={g.topic}><div className="flex justify-between items-center"><b>{g.topic}</b><span className="flex gap-2 items-center text-sm">{g.right}/{g.total} ({g.pct}%) <Badge l={g.level} /></span></div><p className="text-sm text-slate-700 mt-1">{g.reason}</p></Card>)}
      <h2 className="font-semibold mt-5 mb-2">Revision plan: {rep.hoursPerDay} h/day, {rep.days} days</h2>
      {rep.plan.map((p: any) => <Card key={p.day}><b className="text-sm">Day {p.day}</b>{p.sessions.map((s: any, i: number) => <div key={i} className="mt-2 text-sm"><div className="flex gap-2 items-center"><b>{s.topic}</b><Badge l={s.level} /><span className="text-slate-500">{s.minutes} min</span></div><ul className="list-disc ml-5 text-slate-700">{s.tasks.map((t: string, k: number) => <li key={k}>{t}</li>)}</ul></div>)}</Card>)}
    </>}
  </div>);
}

function Assistant() {
  const [q, setQ] = useState(""), [log, setLog] = useState<any[]>([]), [busy, setBusy] = useState(false);
  const ask = async () => { if (!q.trim()) return; const qq = q; setQ(""); setBusy(true); try { const r = await api("/api/chat", { question: qq }); setLog([{ q: qq, ...r }, ...log]); } catch (x: any) { setLog([{ q: qq, answer: x.message, citations: [] }, ...log]); } setBusy(false); };
  return (<div>
    <Card><div className="flex gap-2"><input aria-label="Question" className="border rounded p-2 flex-1" placeholder="Ask about a topic from your material" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} /><Btn busy={busy} onClick={ask}>Explain</Btn></div>
      <p className="text-xs text-slate-500 mt-2">Answers use only your uploaded material. If it is not there, the assistant says so.</p></Card>
    {log.map((m, i) => <Card key={i}><p className="font-medium text-sm">{m.q}</p><p className="text-sm mt-1 whitespace-pre-wrap">{m.answer}</p>
      {m.citations?.map((c: any) => <details key={c.n} className="text-xs text-slate-600 mt-1"><summary className="cursor-pointer">[{c.n}] {c.doc}, p.{c.page}</summary><p className="italic mt-1">{c.snippet}...</p></details>)}</Card>)}
  </div>);
}

function Progress() {
  const [a, setA] = useState<any[]>([]);
  useEffect(() => { api("/api/dashboard").then((r) => setA(r.attempts)).catch(() => {}); }, []);
  if (!a.length) return <Card><p className="text-sm text-slate-600">No attempts yet. Take a quiz to start tracking progress.</p></Card>;
  const W = 560, H = 160, x = (i: number) => (a.length === 1 ? W / 2 : 30 + (i * (W - 60)) / (a.length - 1)), y = (p: number) => H - 20 - (p * (H - 40)) / 100;
  const topics = [...new Set(a.flatMap((t) => Object.keys(t.byTopic)))];
  return (<div>
    <Card><h3 className="font-semibold mb-2">Score per attempt</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label="Score per attempt">
        {[0, 50, 100].map((g) => <g key={g}><line x1="30" x2={W - 20} y1={y(g)} y2={y(g)} stroke="#e2e8f0" /><text x="2" y={y(g) + 4} fontSize="10" fill="#64748b">{g}%</text></g>)}
        <polyline fill="none" stroke="#0f766e" strokeWidth="2" points={a.map((t, i) => `${x(i)},${y(t.pct)}`).join(" ")} />
        {a.map((t, i) => <g key={i}><circle cx={x(i)} cy={y(t.pct)} r="4" fill="#0f766e" /><text x={x(i)} y={y(t.pct) - 8} fontSize="10" textAnchor="middle">{t.pct}%</text><text x={x(i)} y={H - 4} fontSize="10" textAnchor="middle" fill="#64748b">#{t.n}</text></g>)}
      </svg></Card>
    <Card><h3 className="font-semibold mb-2">Topic strength by attempt</h3>
      <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr className="text-left"><th className="py-1">Topic</th>{a.map((t) => <th key={t.n}>#{t.n}</th>)}</tr></thead>
        <tbody>{topics.map((tp) => <tr key={tp} className="border-t"><td className="py-1">{tp}</td>{a.map((t) => <td key={t.n}>{t.byTopic[tp] != null ? `${t.byTopic[tp]}%` : "-"}</td>)}</tr>)}</tbody></table></div></Card>
    <p className="text-sm text-slate-600">After each new attempt, rebuild the gap report to refresh your plan.</p>
  </div>);
}

export default function Home() {
  const [ses, setSes] = useState<any>(undefined), [tab, setTab] = useState("material"), [k, setK] = useState(0);
  useEffect(() => { sb.auth.getSession().then(({ data }) => setSes(data.session)); const { data } = sb.auth.onAuthStateChange((_e, s) => setSes(s)); return () => data.subscription.unsubscribe(); }, []);
  if (ses === undefined) return null;
  if (!ses) return <Login />;
  const tabs = [["material", "Material"], ["quiz", "Diagnostic quiz"], ["report", "Gap report and plan"], ["assistant", "Explain a topic"], ["progress", "Progress"]];
  return (<main className="max-w-4xl mx-auto px-4 py-6">
    <header className="flex justify-between items-center mb-4"><h1 className="text-2xl font-semibold">GapFinder AI</h1><button className="text-sm underline" onClick={() => sb.auth.signOut()}>Sign out ({ses.user.email})</button></header>
    <nav className="flex gap-1 mb-4 flex-wrap" aria-label="Sections">{tabs.map(([id, l]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id} className={`px-3 py-2 rounded text-sm ${tab === id ? "bg-ink text-white" : "bg-white border"}`}>{l}</button>)}</nav>
    {tab === "material" && <Material />}{tab === "quiz" && <Quiz onDone={() => setK(k + 1)} />}{tab === "report" && <Report key={k} />}{tab === "assistant" && <Assistant />}{tab === "progress" && <Progress key={k} />}
  </main>);
}
