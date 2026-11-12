import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Users,
  Database,
  MapPin,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
  Gauge,
  Search,
  Plus,
  Lock,
  ShieldCheck,
  Wifi,
  WifiOff,
  Eye,
} from "lucide-react";
import type { ElectionStore, Submission, TabKey } from "@/types/election";
import { PARTIES } from "@/constants/mockData";
import { shortHash } from "@/utils/cryptoAndRules";

export default function DashboardAndAdmin({ store, tab }: { store: ElectionStore; tab: TabKey }) {
  if (tab === "party") return <PartyView store={store} />;
  if (tab === "admin") return <AdminRegister store={store} />;
  return <CommandCenter store={store} />;
}

// ---------------------------------------------------------------------------
// Shared metric card
// ---------------------------------------------------------------------------
function Metric({ label, value, sub, icon: Icon, tone = "slate" }: { label: string; value: string | number; sub?: string; icon: typeof Activity; tone?: string }) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-400",
    cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-400",
    slate: "border-slate-800 bg-slate-900/60 text-slate-400",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function aggregate(subs: Submission[]) {
  const totals: Record<string, number> = {};
  PARTIES.forEach((p) => (totals[p.code] = 0));
  let valid = 0, rejected = 0, registered = 0, accredited = 0;
  subs.forEach((s) => {
    valid += s.form.validVotes;
    rejected += s.form.rejectedVotes;
    registered += s.form.registeredVoters;
    accredited += s.form.accreditedVoters;
    Object.entries(s.form.partyScores).forEach(([c, v]) => { totals[c] = (totals[c] ?? 0) + v; });
  });
  return { totals, valid, rejected, registered, accredited };
}

// ---------------------------------------------------------------------------
// Command Center — national drilldown
// ---------------------------------------------------------------------------
function CommandCenter({ store }: { store: ElectionStore }) {
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [selState, setSelState] = useState("");
  const [selLga, setSelLga] = useState("");
  const [selWard, setSelWard] = useState("");
  const [detail, setDetail] = useState<Submission | null>(null);

  const subs = store.submissions;
  const agg = aggregate(subs);
  const verified = subs.filter((s) => s.status === "verified").length;
  const flagged = subs.filter((s) => s.status === "flagged").length;
  const pending = subs.filter((s) => s.status === "pending_review").length;
  const queued = store.queue.filter((q) => q.syncStatus !== "synced").length;
  const syncRate = subs.length ? Math.round((subs.filter((s) => s.status !== "queued").length / subs.length) * 100) : 0;

  const states = Array.from(new Set(subs.map((s) => s.state)));
  const scoped = subs.filter((s) => (!selState || s.state === selState) && (!selLga || s.lga === selLga) && (!selWard || s.ward === selWard));
  const lgas = Array.from(new Set(subs.filter((s) => s.state === selState).map((s) => s.lga)));
  const wards = Array.from(new Set(subs.filter((s) => s.lga === selLga).map((s) => s.ward)));

  const maxParty = Math.max(1, ...Object.values(agg.totals));
  const crumbs = [selState, selLga, selWard].filter(Boolean);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric label="Polling Units" value={subs.length} icon={MapPin} tone="cyan" />
        <Metric label="Verified" value={verified} icon={CheckCircle2} tone="emerald" />
        <Metric label="Pending" value={pending} icon={Clock} tone="amber" />
        <Metric label="Flagged" value={flagged} icon={AlertTriangle} tone="rose" />
        <Metric label="Offline Queue" value={queued} icon={Lock} tone="slate" />
        <Metric label="Sync Rate" value={`${syncRate}%`} icon={RefreshCw} tone="emerald" />
      </div>

      {/* party distribution */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <BarChart3 className="h-4 w-4 text-emerald-400" /> Aggregate Party Vote Distribution
        </h3>
        <div className="space-y-2.5">
          {PARTIES.map((p) => {
            const v = agg.totals[p.code] ?? 0;
            const pct = agg.valid ? Math.round((v / agg.valid) * 100) : 0;
            return (
              <div key={p.code} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-right text-xs font-bold" style={{ color: p.color }}>{p.code}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-800">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-md"
                    style={{ background: `linear-gradient(90deg, ${p.color}, ${p.color}99)` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(v / maxParty) * 100}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
                <span className="w-24 shrink-0 font-mono text-xs text-slate-300">{v.toLocaleString()} · {pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* drilldown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Gauge className="h-4 w-4 text-cyan-400" /> Regional Drilldown
          </h3>
          <nav className="flex items-center gap-1 text-xs">
            <button onClick={() => { setLevel(0); setSelState(""); setSelLga(""); setSelWard(""); }} className={`rounded px-2 py-1 font-semibold ${level === 0 ? "bg-cyan-500/15 text-cyan-300" : "text-slate-500 hover:text-slate-300"}`}>National</button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-slate-600" />
                <button onClick={() => { setLevel((i + 1) as 1 | 2 | 3); if (i < 1) { setSelLga(""); setSelWard(""); } if (i < 2) setSelWard(""); }} className="rounded px-2 py-1 font-semibold text-cyan-300 hover:bg-cyan-500/10">{c}</button>
              </span>
            ))}
          </nav>
        </div>

        {level === 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {states.map((st) => {
              const ss = subs.filter((s) => s.state === st);
              const a = aggregate(ss);
              return (
                <button key={st} onClick={() => { setSelState(st); setLevel(1); }} className="group rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-500/40">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-100">{st}</p>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-slate-500">{ss.length} PU · {a.valid.toLocaleString()} valid votes</p>
                  <LeaderChip totals={a.totals} />
                </button>
              );
            })}
          </div>
        )}
        {level === 1 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {lgas.map((l) => {
              const ls = subs.filter((s) => s.lga === l);
              const a = aggregate(ls);
              return (
                <button key={l} onClick={() => { setSelLga(l); setLevel(2); }} className="group rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-500/40">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-100">{l}</p><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" /></div>
                  <p className="text-[11px] text-slate-500">{ls.length} PU · {a.valid.toLocaleString()} votes</p>
                  <LeaderChip totals={a.totals} />
                </button>
              );
            })}
          </div>
        )}
        {level === 2 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {wards.map((w) => {
              const ws = subs.filter((s) => s.ward === w);
              const a = aggregate(ws);
              return (
                <button key={w} onClick={() => { setSelWard(w); setLevel(3); }} className="group rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-500/40">
                  <div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-100">{w}</p><ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400" /></div>
                  <p className="text-[11px] text-slate-500">{ws.length} PU · {a.valid.toLocaleString()} votes</p>
                </button>
              );
            })}
          </div>
        )}
        {level === 3 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scoped.map((s) => (
              <button key={s.id} onClick={() => setDetail(s)} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 text-left transition hover:border-emerald-500/40">
                <img src={s.imageUrl} alt="EC8A" className="h-14 w-10 rounded border border-slate-800 bg-slate-950 object-cover object-top" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-slate-500">{s.refId}</p>
                  <p className="truncate text-xs font-bold text-slate-100">{s.puCode}</p>
                  <StatusPill status={s.status} />
                </div>
                <Eye className="h-4 w-4 text-slate-600" />
              </button>
            ))}
          </div>
        )}
      </div>

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function LeaderChip({ totals }: { totals: Record<string, number> }) {
  const leader = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  if (!leader || leader[1] === 0) return null;
  const p = PARTIES.find((x) => x.code === leader[0]);
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: p?.color }} />
      <span className="text-[10px] font-semibold text-slate-400">Leader {leader[0]} · {leader[1].toLocaleString()}</span>
    </div>
  );
}

function StatusPill({ status }: { status: Submission["status"] }) {
  const map: Record<string, { c: string; i: typeof CheckCircle2 }> = {
    verified: { c: "bg-emerald-500/15 text-emerald-300", i: CheckCircle2 },
    pending_review: { c: "bg-amber-500/15 text-amber-300", i: Clock },
    flagged: { c: "bg-rose-500/15 text-rose-300", i: AlertTriangle },
    queued: { c: "bg-slate-500/15 text-slate-300", i: Lock },
    rejected: { c: "bg-rose-500/15 text-rose-300", i: XCircle },
    superseded: { c: "bg-violet-500/15 text-violet-300", i: RefreshCw },
  };
  const m = map[status] ?? map.verified;
  const Icon = m.i;
  return <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${m.c}`}><Icon className="h-3 w-3" /> {status.replace(/_/g, " ")}</span>;
}

function DetailModal({ detail, onClose }: { detail: Submission | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {detail && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <img src={detail.imageUrl} alt="EC8A" className="w-full rounded-lg border border-slate-800 bg-slate-950" />
              <div className="space-y-2">
                <p className="font-mono text-xs text-slate-500">{detail.refId}</p>
                <h3 className="text-base font-bold text-slate-100">{detail.puCode}</h3>
                <p className="text-xs text-slate-400">{detail.puName} · {detail.ward}, {detail.lga}, {detail.state}</p>
                <StatusPill status={detail.status} />
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <KV k="Registered" v={detail.form.registeredVoters} />
                  <KV k="Accredited" v={detail.form.accreditedVoters} />
                  <KV k="Valid Votes" v={detail.form.validVotes} />
                  <KV k="Rejected" v={detail.form.rejectedVotes} />
                  <KV k="Quality" v={`${detail.quality.overall}%`} />
                  <KV k="Rules" v={detail.validation.passed ? "PASS" : `${detail.validation.failingCount} fail`} />
                </div>
                <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-2">
                  <p className="text-[10px] font-semibold uppercase text-cyan-400">Image SHA-256</p>
                  <p className="break-all font-mono text-[10px] text-cyan-200">{detail.imageHash || shortHash(detail.refId, 20, 12)}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-800 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Party Scores</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PARTIES.map((p) => (
                  <div key={p.code} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-center">
                    <p className="text-[10px] font-bold" style={{ color: p.color }}>{p.code}</p>
                    <p className="font-mono text-sm text-slate-100">{detail.form.partyScores[p.code] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="w-full border-t border-slate-800 bg-slate-800 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700">Close</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KV({ k, v }: { k: string; v: string | number }) {
  return <div className="rounded-md border border-slate-800 bg-slate-950/50 p-1.5"><p className="text-[9px] uppercase text-slate-500">{k}</p><p className="font-mono text-sm font-bold text-slate-100">{typeof v === "number" ? v.toLocaleString() : v}</p></div>;
}

// ---------------------------------------------------------------------------
// Party Coordinator View
// ---------------------------------------------------------------------------
function PartyView({ store }: { store: ElectionStore }) {
  const party = store.persona.party ?? "APC";
  const p = PARTIES.find((x) => x.code === party)!;
  const subs = store.submissions;
  const covered = subs.filter((s) => (s.form.partyScores[party] ?? 0) >= 0).length;
  const myVotes = subs.reduce((a, s) => a + (s.form.partyScores[party] ?? 0), 0);
  const agg = aggregate(subs);
  const rank = Object.entries(agg.totals).sort((a, b) => b[1] - a[1]).findIndex(([c]) => c === party) + 1;
  const puAgg = subs.map((s) => ({ s, votes: s.form.partyScores[party] ?? 0 })).sort((a, b) => b.votes - a.votes);
  const maxV = Math.max(1, ...puAgg.map((x) => x.votes));

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4">
      <div className="flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: `${p.color}55`, background: `${p.color}10` }}>
        <div className="grid h-12 w-12 place-items-center rounded-xl text-lg font-bold text-slate-950" style={{ background: p.color }}>{p.code[0]}</div>
        <div className="mr-auto">
          <h2 className="text-base font-bold text-slate-100">{p.name}</h2>
          <p className="text-xs text-slate-400">{store.persona.name} · {store.persona.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Party Votes" value={myVotes.toLocaleString()} icon={BarChart3} tone="emerald" />
        <Metric label="National Rank" value={`#${rank}`} icon={Activity} tone="cyan" />
        <Metric label="PUs Reporting" value={covered} icon={MapPin} tone="slate" />
        <Metric label="Vote Share" value={`${agg.valid ? Math.round((myVotes / agg.valid) * 100) : 0}%`} icon={Gauge} tone="amber" />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400"><Users className="h-4 w-4" style={{ color: p.color }} /> Per-Polling-Unit Party Totals</h3>
        <div className="space-y-2">
          {puAgg.map(({ s, votes }) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate font-mono text-[11px] text-slate-400">{s.puCode}</span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-800">
                <motion.div className="absolute inset-y-0 left-0" style={{ background: `linear-gradient(90deg, ${p.color}, ${p.color}88)` }} initial={{ width: 0 }} animate={{ width: `${(votes / maxV) * 100}%` }} transition={{ duration: 0.6 }} />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-slate-300">{votes}</span>
              <StatusPill status={s.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Register + Health Telemetry
// ---------------------------------------------------------------------------
function AdminRegister({ store }: { store: ElectionStore }) {
  const [q, setQ] = useState("");
  const units = store.pollingUnits.filter((u) => !q || u.code.toLowerCase().includes(q.toLowerCase()) || u.name.toLowerCase().includes(q.toLowerCase()));

  const online = store.submissions.filter((s) => s.status !== "queued").length;
  const offline = store.submissions.length - online;
  const totalAttempts = store.queue.reduce((a, q2) => a + q2.attempts, 0);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4">
      {/* health telemetry */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Active PU Register" value={store.pollingUnits.length} icon={Database} tone="cyan" />
        <Metric label="Synced Records" value={online} icon={Wifi} tone="emerald" />
        <Metric label="Offline Queued" value={offline} icon={WifiOff} tone="amber" />
        <Metric label="Retry Attempts" value={totalAttempts} icon={RefreshCw} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* register */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400"><Database className="h-4 w-4 text-sky-400" /> INEC Polling Unit Register</h3>
            <button className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-110"><Plus className="h-3.5 w-3.5" /> Add PU</button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name" className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-sky-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3">Agent</th><th className="py-2 pr-3">Party</th><th className="py-2 pr-3 text-right">Reg.</th><th className="py-2 pr-3 text-center">Status</th></tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.code} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="py-2 pr-3 font-mono text-slate-300">{u.code}</td>
                    <td className="py-2 pr-3 text-slate-400">{u.name}</td>
                    <td className="py-2 pr-3 text-slate-300">{u.assignedAgent}</td>
                    <td className="py-2 pr-3"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: PARTIES.find((p) => p.code === u.party)?.color, background: `${PARTIES.find((p) => p.code === u.party)?.color}22` }}>{u.party}</span></td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-400">{u.registeredVoters}</td>
                    <td className="py-2 pr-3 text-center">{u.active ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" /> : <XCircle className="mx-auto h-4 w-4 text-slate-600" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* audit integrity */}
        <div className="space-y-4">
          <div className={`rounded-2xl border p-4 ${store.chainValid ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/10"}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${store.chainValid ? "text-emerald-400" : "text-rose-400"}`} />
              <h3 className="text-sm font-bold text-slate-100">Ledger Integrity</h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">{store.chainValid ? "All blocks hash-verified." : `Tamper detected at block #${store.chainBrokenAt}.`}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-100">{store.ledger.length}<span className="ml-1 text-xs font-normal text-slate-500">blocks</span></p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400"><Activity className="h-4 w-4 text-cyan-400" /> Sync Queue</h3>
            {store.queue.length === 0 ? (
              <p className="text-xs text-slate-500">No queued uploads.</p>
            ) : (
              <div className="space-y-1.5">
                {store.queue.map((qi) => (
                  <div key={qi.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5">
                    <span className="font-mono text-[10px] text-slate-400">{qi.refId}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${qi.syncStatus === "synced" ? "bg-emerald-500/15 text-emerald-300" : qi.syncStatus === "failed" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>{qi.syncStatus}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
