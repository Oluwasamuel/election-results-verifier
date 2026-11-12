import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Hash,
  Link2,
  Lock,
  Fingerprint,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Filter,
  Eye,
  FileJson,
  Loader2,
  ArrowLeft,
  TriangleAlert,
} from "lucide-react";
import type {
  EC8AFormData,
  ElectionStore,
  Submission,
  TabKey,
} from "@/types/election";
import { PARTIES } from "@/constants/mockData";
import { shortHash } from "@/utils/cryptoAndRules";

// ===========================================================================
// Review Queue + Ledger Explorer + Audit Export
// ===========================================================================
export default function ReviewAndLedger({ store, tab }: { store: ElectionStore; tab: TabKey }) {
  if (tab === "ledger") return <LedgerExplorer store={store} />;
  return <ReviewQueue store={store} />;
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------
function ReviewQueue({ store }: { store: ElectionStore }) {
  const [filter, setFilter] = useState<"all" | "pending_review" | "flagged">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<EC8AFormData | null>(null);

  const reviewable = store.submissions.filter(
    (s) => s.status === "pending_review" || s.status === "flagged"
  );
  const list = filter === "all" ? reviewable : reviewable.filter((s) => s.status === filter);
  const current = store.submissions.find((s) => s.id === selectedId) ?? null;

  function openReview(s: Submission) {
    setSelectedId(s.id);
    setEdit(JSON.parse(JSON.stringify(s.form)));
    setNote("");
  }

  const partySum = edit ? Object.values(edit.partyScores).reduce((a, b) => a + b, 0) : 0;

  if (current && edit) {
    return (
      <div className="mx-auto max-w-[1600px] p-4">
        <button onClick={() => setSelectedId(null)} className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Back to queue
        </button>
        <div className="grid gap-4 xl:grid-cols-2">
          {/* source of truth */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                <Eye className="h-4 w-4 text-cyan-400" /> Source-of-Truth Sheet
              </h3>
              <span className="font-mono text-[10px] text-slate-500">{shortHash(current.imageHash)}</span>
            </div>
            <img src={current.imageUrl} alt="EC8A" className="w-full rounded-lg border border-slate-800 bg-slate-950" />
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
              <Fingerprint className="h-4 w-4 text-emerald-400" />
              <p className="break-all font-mono text-[10px] text-slate-400">{current.imageHash}</p>
            </div>
          </div>

          {/* correction panel */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Reviewer Correction</h3>
              <p className="mb-3 text-[11px] text-slate-500">{current.puCode} — {current.puName} · {current.refId}</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {current.validation.results.filter((r) => !r.passed).map((r) => (
                  <span key={r.id} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.severity === "error" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>
                    <AlertTriangle className="h-3 w-3" /> {r.id} {r.label}
                  </span>
                ))}
                {current.validation.passed && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Rules pass
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(["registeredVoters", "accreditedVoters", "ballotIssued", "unusedBallots", "spoiledBallots", "rejectedVotes", "validVotes"] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{k}</span>
                    <input type="number" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: +e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-amber-500" />
                  </label>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Party Scores</p>
                <div className="grid grid-cols-3 gap-2">
                  {PARTIES.map((p) => (
                    <div key={p.code}>
                      <label className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold" style={{ color: p.color }}>{p.code}</label>
                      <input type="number" value={edit.partyScores[p.code] ?? 0} onChange={(e) => setEdit({ ...edit, partyScores: { ...edit.partyScores, [p.code]: Math.max(0, +e.target.value) } })} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-amber-500" />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
                  <span className="text-slate-400">Party sum vs valid</span>
                  <span className={`font-mono font-bold ${partySum === edit.validVotes ? "text-emerald-400" : "text-rose-400"}`}>{partySum} / {edit.validVotes}</span>
                </div>
              </div>
            </div>

            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note / audit justification (required for corrections)..." rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500" />

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => { if (!note.trim()) { alert("Add a reviewer note first"); return; } store.approveCorrection(current.id, edit, note); setSelectedId(null); }} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2 py-2.5 text-xs font-bold text-slate-950 hover:brightness-110">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button onClick={() => { store.requestResubmit(current.id, note || "Recapture required"); setSelectedId(null); }} className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-2 py-2.5 text-xs font-bold text-slate-950 hover:brightness-110">
                <RefreshCw className="h-4 w-4" /> Resubmit
              </button>
              <button onClick={() => { store.rejectSubmission(current.id, note || "Rejected"); setSelectedId(null); }} className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-2 py-2.5 text-xs font-bold text-white hover:brightness-110">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2 text-base font-bold text-slate-100">
          <ClipboardCheck className="h-5 w-5 text-amber-400" /> Review Queue
        </h2>
        {(["all", "pending_review", "flagged"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"}`}>
            {f === "pending_review" ? "Low Confidence" : f === "flagged" ? "GPS Flagged" : "All"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/50" />
            <p className="mt-2 text-sm font-semibold text-slate-300">Queue clear</p>
            <p className="text-xs text-slate-500">No submissions awaiting review.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <motion.button
              key={s.id}
              layout
              onClick={() => openReview(s)}
              className={`group overflow-hidden rounded-2xl border bg-slate-900/60 text-left transition hover:border-amber-500/40 ${s.status === "flagged" ? "border-rose-500/30" : "border-slate-800"}`}
            >
              <div className="relative h-32 overflow-hidden bg-slate-950">
                <img src={s.imageUrl} alt="EC8A" className="h-full w-full object-cover object-top" />
                <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.status === "flagged" ? "bg-rose-500 text-white" : "bg-amber-500 text-slate-950"}`}>
                  {s.status === "flagged" ? "GPS FLAG" : "LOW CONF"}
                </span>
              </div>
              <div className="p-3">
                <p className="font-mono text-[11px] text-slate-500">{s.refId}</p>
                <p className="text-sm font-bold text-slate-100">{s.puCode}</p>
                <p className="truncate text-[11px] text-slate-400">{s.puName}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{s.validation.failingCount} rule issue(s)</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 opacity-0 transition group-hover:opacity-100">
                    Review <ArrowLeft className="h-3 w-3 rotate-180" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger Explorer + Tamper Simulator + Audit Export
// ---------------------------------------------------------------------------
function LedgerExplorer({ store }: { store: ElectionStore }) {
  const [busy, setBusy] = useState(false);
  const [fState, setFState] = useState("");
  const [fLga, setFLga] = useState("");
  const [fPu, setFPu] = useState("");
  const [q, setQ] = useState("");

  const states = useMemo(() => Array.from(new Set(store.submissions.map((s) => s.state))), [store.submissions]);

  async function runVerify() {
    setBusy(true);
    await store.verifyChain();
    setBusy(false);
  }

  function download() {
    const bundle = store.exportBundle({ state: fState || undefined, lga: fLga || undefined, puCode: fPu || undefined });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ec8a-audit-${bundle.generatedAt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 p-4">
      {/* status header */}
      <div className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${store.chainValid ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/10"}`}>
        <div className={`grid h-12 w-12 place-items-center rounded-xl ${store.chainValid ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
          {store.chainValid ? <ShieldCheck className="h-6 w-6 text-emerald-400" /> : <ShieldAlert className="h-6 w-6 text-rose-400" />}
        </div>
        <div className="mr-auto">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
            <ScrollText className="h-5 w-5 text-cyan-400" /> Append-Only Ledger
          </h2>
          <p className={`text-xs font-semibold ${store.chainValid ? "text-emerald-300" : "text-rose-300"}`}>
            {store.chainValid ? `Chain integrity verified · ${store.ledger.length} blocks` : `TAMPERING DETECTED at block #${store.chainBrokenAt}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={runVerify} disabled={busy} className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify Chain
          </button>
          <button onClick={store.simulateTamper} className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20">
            <TriangleAlert className="h-4 w-4" /> Simulate Tamper
          </button>
          <button onClick={store.resetTamper} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700">
            <RefreshCw className="h-4 w-4" /> Restore
          </button>
        </div>
      </div>

      {/* audit export */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <FileJson className="h-4 w-4 text-emerald-400" /> Audit Export Tool
        </h3>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setFPu(e.target.value); }} placeholder="PU code" className="w-40 rounded-lg border border-slate-700 bg-slate-800 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-emerald-500" />
          </div>
          <select value={fState} onChange={(e) => setFState(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500">
            <option value="">All States</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fLga} onChange={(e) => setFLga(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500">
            <option value="">All LGAs</option>
            {Array.from(new Set(store.submissions.filter((s) => !fState || s.state === fState).map((s) => s.lga))).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={download} className="ml-auto flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:brightness-110">
            <Download className="h-4 w-4" /> Export JSON
          </button>
        </div>
      </div>

      {/* chain visualizer */}
      <div className="space-y-0">
        {store.ledger.map((b, i) => {
          const broken = !store.chainValid && store.chainBrokenAt !== null && i >= store.chainBrokenAt;
          return (
            <div key={b.index}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className={`relative overflow-hidden rounded-xl border p-3 ${
                  b.tampered || broken
                    ? "border-rose-500/50 bg-rose-500/10"
                    : "border-slate-800 bg-slate-900/60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold ${b.tampered || broken ? "bg-rose-500/20 text-rose-300" : "bg-cyan-500/15 text-cyan-300"}`}>
                    #{b.index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        b.entryType === "INITIAL_SUBMISSION" ? "bg-emerald-500/15 text-emerald-300" : b.entryType === "REVIEWER_CORRECTION" ? "bg-amber-500/15 text-amber-300" : "bg-violet-500/15 text-violet-300"
                      }`}>{b.entryType.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[11px] text-slate-400">{b.refId}</span>
                      {(b.tampered || broken) && <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400"><ShieldAlert className="h-3 w-3" /> HASH MISMATCH</span>}
                    </div>
                    <div className="mt-1.5 grid gap-1 font-mono text-[10px] text-slate-500 sm:grid-cols-3">
                      <HashRow label="prev" hash={b.prevHash} />
                      <HashRow label="payload" hash={b.payloadHash} warn={b.tampered} />
                      <HashRow label="block" hash={b.blockHash} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">{new Date(b.timestamp).toLocaleString()}</p>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-400"><Lock className="h-3 w-3" /> {shortHash(b.agentSignature, 6, 4)}</p>
                  </div>
                </div>
              </motion.div>
              {i < store.ledger.length - 1 && (
                <div className="flex justify-center py-1">
                  <Link2 className={`h-4 w-4 ${broken && store.chainBrokenAt === i ? "text-rose-500" : "text-slate-700"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HashRow({ label, hash, warn }: { label: string; hash: string; warn?: boolean }) {
  return (
    <div className="truncate">
      <span className="text-slate-600">{label}: </span>
      <span className={warn ? "text-rose-400 line-through" : "text-slate-400"}>{shortHash(hash, 12, 6)}</span>
    </div>
  );
}
