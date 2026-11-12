import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import AgentCaptureFlow from "@/components/AgentCaptureFlow";
import ReviewAndLedger from "@/components/ReviewAndLedger";
import DashboardAndAdmin from "@/components/DashboardAndAdmin";
import { PERSONAS, POLLING_UNITS, SEED_SUBMISSIONS } from "@/constants/mockData";
import {
  appendLedgerBlock,
  buildLedgerFromSubmissions,
  computeSHA256,
  verifyFullLedgerChain,
} from "@/utils/cryptoAndRules";
import type {
  AuditBundle,
  EC8AFormData,
  ElectionStore,
  LedgerBlock,
  Persona,
  QueueItem,
  Submission,
  TabKey,
  UserRole,
} from "@/types/election";

const STORAGE_KEY = "ec8a_verify_state_v1";

const ROLE_DEFAULT_TAB: Record<UserRole, TabKey> = {
  agent: "capture",
  coordinator: "party",
  reviewer: "review",
  observer: "dashboard",
  admin: "admin",
  auditor: "ledger",
};

function makeQueueItem(s: Submission): QueueItem {
  return {
    id: `q-${s.id}`,
    submissionId: s.id,
    refId: s.refId,
    payloadHash: s.imageHash,
    imageUrl: s.imageUrl,
    gps: s.gps,
    attempts: s.attempts || 1,
    syncStatus: "pending",
    queuedAt: Date.now(),
    encryptedBlob: `AES-GCM::${s.imageHash.slice(0, 24)}::${s.refId}`,
  };
}

export default function App() {
  const [role, setRoleState] = useState<UserRole>("agent");
  const [online, setOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("capture");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ledger, setLedger] = useState<LedgerBlock[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [chainValid, setChainValid] = useState(true);
  const [chainBrokenAt, setChainBrokenAt] = useState<number | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Submission | null>(null);
  const [inspectSubmission, setInspect] = useState<Submission | null>(null);
  const [booting, setBooting] = useState(true);
  const hydrated = useRef(false);

  const persona: Persona = useMemo(
    () => PERSONAS.find((p) => p.role === role) ?? PERSONAS[0],
    [role]
  );

  // ---- Hydrate from localStorage or seed ---------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!cancelled) {
            setSubmissions(parsed.submissions ?? []);
            setLedger(parsed.ledger ?? []);
            setQueue(parsed.queue ?? []);
            setRoleState(parsed.role ?? "agent");
            setOnline(parsed.online ?? true);
            setActiveTab(parsed.activeTab ?? ROLE_DEFAULT_TAB[parsed.role ?? "agent"]);
          }
        } else {
          const built = await buildLedgerFromSubmissions(SEED_SUBMISSIONS);
          if (!cancelled) {
            const withIdx = SEED_SUBMISSIONS.map((s) => {
              const blk = built.find((b) => b.submissionId === s.id);
              return { ...s, ledgerIndex: blk?.index, imageHash: s.imageHash || blk?.payloadHash || "" };
            });
            setSubmissions(withIdx);
            setLedger(built);
            setQueue(withIdx.filter((s) => s.status === "queued").map(makeQueueItem));
          }
        }
      } catch {
        const built = await buildLedgerFromSubmissions(SEED_SUBMISSIONS);
        if (!cancelled) {
          setSubmissions(SEED_SUBMISSIONS);
          setLedger(built);
        }
      } finally {
        if (!cancelled) {
          hydrated.current = true;
          setBooting(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Persist -----------------------------------------------------------
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ submissions, ledger, queue, role, online, activeTab })
      );
    } catch {
      /* quota — ignore for demo */
    }
  }, [submissions, ledger, queue, role, online, activeTab]);

  const setRole = useCallback((r: UserRole) => {
    setRoleState(r);
    setActiveTab(ROLE_DEFAULT_TAB[r]);
  }, []);

  const verifyChain = useCallback(async () => {
    const res = await verifyFullLedgerChain(ledger);
    setChainValid(res.isValid);
    setChainBrokenAt(res.brokenAtIndex);
    if (res.isValid) toast.success(`Chain verified · ${ledger.length} blocks intact`);
    else toast.error(`Tamper detected at block #${res.brokenAtIndex}`);
  }, [ledger]);

  const addSubmission = useCallback(
    (s: Submission) => {
      (async () => {
        const hash = s.imageHash || (await computeSHA256(s.imageUrl));
        if (online) {
          const committed: Submission = {
            ...s,
            imageHash: hash,
            status: s.validation.results.some((r) => r.severity === "error")
              ? "pending_review"
              : "verified",
            syncedAt: Date.now(),
          };
          setLedger((prevLedger) => {
            const block = buildBlockSync(prevLedger, committed);
            setSubmissions((prev) => [{ ...committed, ledgerIndex: block.index }, ...prev]);
            return [...prevLedger, block];
          });
          toast.success(`Committed to ledger · ${committed.refId}`);
        } else {
          const queued: Submission = { ...s, imageHash: hash, status: "queued" };
          setSubmissions((prev) => [queued, ...prev]);
          setQueue((prev) => [makeQueueItem(queued), ...prev]);
          toast.warning(`Offline · ${queued.refId} encrypted in local queue`);
        }
      })();
    },
    [online]
  );

  const syncAll = useCallback(() => {
    if (!online) { toast.error("No network connection"); return; }
    const pending = queue.filter((q) => q.syncStatus !== "synced");
    if (pending.length === 0) { toast.info("Queue already empty"); return; }
    setQueue((prev) => prev.map((q) => (q.syncStatus === "synced" ? q : { ...q, syncStatus: "syncing" })));
    window.setTimeout(async () => {
      let runningLedger = [...ledger];
      const syncedIds = new Set<string>();
      for (const qi of pending) {
        const sub = submissions.find((s) => s.id === qi.submissionId);
        if (!sub) continue;
        const block = await appendLedgerBlock(runningLedger, sub, "INITIAL_SUBMISSION");
        runningLedger = [...runningLedger, block];
        syncedIds.add(sub.id);
      }
      setLedger(runningLedger);
      setSubmissions((prev) =>
        prev.map((s) =>
          syncedIds.has(s.id)
            ? { ...s, status: "verified", syncedAt: Date.now(), ledgerIndex: runningLedger.find((b) => b.submissionId === s.id)?.index }
            : s
        )
      );
      setQueue((prev) => prev.map((q) => (syncedIds.has(q.submissionId) ? { ...q, syncStatus: "synced" } : q)));
      toast.success(`Synced ${syncedIds.size} queued upload(s) to ledger`);
    }, 1400);
  }, [online, queue, ledger, submissions]);

  const approveCorrection = useCallback(
    (submissionId: string, corrected: EC8AFormData, note: string) => {
      (async () => {
        setSubmissions((prev) => {
          const target = prev.find((s) => s.id === submissionId);
          if (!target) return prev;
          const updated: Submission = {
            ...target,
            form: corrected,
            status: "verified",
            reviewNote: note,
            syncedAt: Date.now(),
          };
          const correctedCopy = { ...updated };
          appendLedgerBlock(ledger, correctedCopy, "REVIEWER_CORRECTION", target.id).then((block) => {
            setLedger((l) => [...l, block]);
            setSubmissions((p) => p.map((s) => (s.id === submissionId ? { ...s, ledgerIndex: block.index } : s)));
          });
          return p2Update(prev, submissionId, updated);
        });
        toast.success(`Correction approved · ${submissionId}`);
      })();
    },
    [ledger]
  );

  const rejectSubmission = useCallback((submissionId: string, note: string) => {
    setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? { ...s, status: "rejected", reviewNote: note } : s)));
    toast.error(`Submission rejected · ${submissionId}`);
  }, []);

  const requestResubmit = useCallback((submissionId: string, note: string) => {
    setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? { ...s, status: "pending_review", reviewNote: note } : s)));
    toast.warning(`Resubmit requested · ${submissionId}`);
  }, []);

  const simulateTamper = useCallback(() => {
    if (ledger.length < 2) { toast.info("Need at least 2 blocks"); return; }
    const idx = Math.floor(ledger.length / 2);
    setLedger((prev) =>
      prev.map((b, i) =>
        i === idx
          ? { ...b, tampered: true, payloadHash: (b.payloadHash.slice(0, -4) + "DEAD").slice(0, 64) }
          : b
      )
    );
    setChainValid(false);
    setChainBrokenAt(idx);
    toast.error(`Tamper injected into block #${idx}`);
  }, [ledger]);

  const resetTamper = useCallback(async () => {
    const built = await buildLedgerFromSubmissions([...submissions].sort((a, b) => a.capturedAt - b.capturedAt));
    setLedger(built);
    setChainValid(true);
    setChainBrokenAt(null);
    toast.success("Ledger rebuilt from source-of-truth submissions");
  }, [submissions]);

  const exportBundle = useCallback(
    (filter: { state?: string; lga?: string; puCode?: string }): AuditBundle => {
      const filtered = submissions.filter(
        (s) =>
          (!filter.state || s.state === filter.state) &&
          (!filter.lga || s.lga === filter.lga) &&
          (!filter.puCode || s.puCode.toLowerCase().includes(filter.puCode.toLowerCase()))
      );
      const filteredIds = new Set(filtered.map((s) => s.id));
      const blocks = ledger.filter((b) => filteredIds.has(b.submissionId));
      const bundle: AuditBundle = {
        generatedAt: Date.now(),
        manifest: {
          ledgerHeight: blocks.length,
          chainValid,
          submissions: filtered.length,
          verified: filtered.filter((s) => s.status === "verified").length,
          flagged: filtered.filter((s) => s.status === "flagged").length,
        },
        blocks,
        certificate: `EC8A-AUDIT-${Date.now()}-${(chainValid ? "VALID" : "COMPROMISED")}`,
      };
      toast.success(`Audit bundle generated · ${blocks.length} blocks`);
      return bundle;
    },
    [submissions, ledger, chainValid]
  );

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const store: ElectionStore = {
    role,
    persona,
    personas: PERSONAS,
    online,
    activeTab,
    pollingUnits: POLLING_UNITS,
    submissions,
    ledger,
    queue,
    chainValid,
    chainBrokenAt,
    activeReceipt,
    inspectSubmission,
    setRole,
    setActiveTab,
    toggleOnline: () => setOnline((v) => !v),
    syncAll,
    addSubmission,
    approveCorrection,
    rejectSubmission,
    requestResubmit,
    verifyChain,
    simulateTamper,
    resetTamper,
    exportBundle,
    openReceipt: setActiveReceipt,
    inspect: setInspect,
    resetDemo,
  };

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
          </div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Rebuilding hash chain...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative">
        <Navigation store={store} />
        <main className="pb-16">
          {activeTab === "capture" && <AgentCaptureFlow store={store} />}
          {(activeTab === "review" || activeTab === "ledger") && <ReviewAndLedger store={store} tab={activeTab} />}
          {(activeTab === "dashboard" || activeTab === "party" || activeTab === "admin") && (
            <DashboardAndAdmin store={store} tab={activeTab} />
          )}
        </main>
      </div>
      <Toaster position="top-right" theme="dark" richColors closeButton />
    </div>
  );
}

// ---- helpers -------------------------------------------------------------
function p2Update(prev: Submission[], id: string, updated: Submission): Submission[] {
  return prev.map((s) => (s.id === id ? updated : s));
}

// Synchronous block builder fallback for instant commit UX (hash already known).
function buildBlockSync(chain: LedgerBlock[], s: Submission): LedgerBlock {
  const prevHash = chain.length > 0 ? chain[chain.length - 1].blockHash : "0".repeat(64);
  const payloadHash = s.imageHash || s.refId;
  const timestamp = Date.now();
  const entryType = "INITIAL_SUBMISSION";
  // Deterministic lightweight block hash (full SHA-256 recomputed on verify).
  let h = 2166136261;
  const seed = `${prevHash}|${payloadHash}|${timestamp}|${entryType}`;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const blockHash = h.toString(16).padStart(8, "0").repeat(8).slice(0, 64);
  return {
    index: chain.length,
    timestamp,
    prevHash,
    payloadHash,
    blockHash,
    entryType,
    submissionId: s.id,
    refId: s.refId,
    agentSignature: (s.imageHash + s.refId).slice(0, 48),
  };
}
