import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  ScanLine,
  Crosshair,
  Gauge,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Fingerprint,
  QrCode,
  Download,
  Share2,
  RefreshCw,
  Hash,
  ChevronRight,
  Loader2,
  Zap,
} from "lucide-react";
import type {
  EC8AFormData,
  ElectionStore,
  QualityReport,
  Submission,
} from "@/types/election";
import {
  PARTIES,
  POLLING_UNITS,
  buildSubmission,
  makeEC8ASvg,
  puByCode,
} from "@/constants/mockData";
import {
  computeSHA256,
  makeRefId,
  simulateOCRExtraction,
  simulateQualityAnalysis,
  shortHash,
  validateEC8ARules,
} from "@/utils/cryptoAndRules";

type Phase = "idle" | "scanning" | "review";

const SAMPLE_FORMS: EC8AFormData[] = POLLING_UNITS.slice(0, 4).map((pu) => {
  const accredited = Math.round(pu.registeredVoters * 0.62);
  const valid = accredited - 14;
  const scores: Record<string, number> = {};
  let remaining = valid;
  PARTIES.forEach((p, i) => {
    const share = i === PARTIES.length - 1 ? remaining : Math.round(remaining * (0.4 - i * 0.06));
    scores[p.code] = Math.max(0, share);
    remaining -= scores[p.code];
  });
  return {
    puCode: pu.code,
    puName: pu.name,
    state: pu.state,
    lga: pu.lga,
    ward: pu.ward,
    registeredVoters: pu.registeredVoters,
    accreditedVoters: accredited,
    ballotIssued: accredited,
    unusedBallots: 8,
    spoiledBallots: 3,
    rejectedVotes: 6,
    validVotes: valid,
    totalVotesCast: valid + 6,
    partyScores: scores,
  };
});

export default function AgentCaptureFlow({ store }: { store: ElectionStore }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [form, setForm] = useState<EC8AFormData>(SAMPLE_FORMS[0]);
  const [imageHash, setImageHash] = useState("");
  const [hashing, setHashing] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Submission | null>(null);
  const scanTimer = useRef<number | null>(null);

  const pu = puByCode(form.puCode);
  const ocrFields = useMemo(
    () => simulateOCRExtraction(form, form.puCode),
    [form]
  );
  const agentGps = {
    lat: (pu?.latitude ?? 9) + 0.0012,
    lng: (pu?.longitude ?? 7) + 0.0009,
  };
  const validation = useMemo(
    () =>
      validateEC8ARules(
        form,
        quality ?? { overall: 100 } as QualityReport,
        agentGps,
        { lat: pu?.latitude ?? 9, lng: pu?.longitude ?? 7 },
        form.puCode
      ),
    [form, quality, pu]
  );

  useEffect(() => () => { if (scanTimer.current) window.clearTimeout(scanTimer.current); }, []);

  function startCapture(lowQuality = false) {
    setPhase("scanning");
    setQuality(null);
    setImageHash("");
    const src = makeEC8ASvg(form, { lowQuality });
    scanTimer.current = window.setTimeout(async () => {
      setHashing(true);
      const hash = await computeSHA256(src);
      setImageHash(hash);
      setHashing(false);
      setImageUrl(src);
      setQuality(simulateQualityAnalysis(form.puCode + (lowQuality ? "-lq" : ""), lowQuality));
      setPhase("review");
    }, 1700);
  }

  function updateScore(code: string, val: number) {
    setForm((f) => ({ ...f, partyScores: { ...f.partyScores, [code]: Math.max(0, val || 0) } }));
  }
  function updateField(key: keyof EC8AFormData, val: number) {
    setForm((f) => ({ ...f, [key]: Math.max(0, val || 0) }));
  }

  async function commitSubmission() {
    const s = buildSubmission(form, {
      agent: store.persona.name,
      party: store.persona.party ?? Object.keys(form.partyScores)[0] ?? "APC",
      status: store.online ? "verified" : "queued",
      capturedAt: Date.now(),
      lowQuality: !quality?.passed,
    });
    s.imageHash = imageHash;
    s.imageUrl = imageUrl;
    s.refId = makeRefId(form.puCode, form.puCode + Date.now());
    s.validation = validation;
    s.quality = quality ?? s.quality;
    s.ocrFields = ocrFields;
    store.addSubmission(s);
    setReceipt(s);
  }

  const partySum = Object.values(form.partyScores).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 p-4 lg:grid-cols-[minmax(0,440px)_1fr]">
      {/* ---------------- Viewfinder / capture ---------------- */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Camera className="h-4 w-4 text-emerald-400" /> Field Capture
            </h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
              {store.persona.puCode ?? "MOBILE UNIT"}
            </span>
          </div>

          {/* sample selector */}
          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">Source sheet</span>
            <div className="flex gap-2">
              <select
                value={sampleIdx}
                onChange={(e) => { setSampleIdx(+e.target.value); setForm(SAMPLE_FORMS[+e.target.value]); setPhase("idle"); }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
              >
                {SAMPLE_FORMS.map((f, i) => (
                  <option key={f.puCode} value={i}>{f.puCode} — {f.puName}</option>
                ))}
              </select>
              <label className="grid cursor-pointer place-items-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-slate-400 hover:border-emerald-500 hover:text-emerald-400">
                <Upload className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) startCapture(false); }} />
              </label>
            </div>
          </label>

          {/* viewfinder */}
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            {phase === "idle" && (
              <IdleViewfinder form={form} />
            )}
            {phase === "scanning" && (
              <ScanningOverlay form={form} />
            )}
            {phase === "review" && imageUrl && (
              <img src={imageUrl} alt="Captured EC8A" className="h-full w-full object-contain" />
            )}
            {phase !== "review" && <GuideOverlay />}
          </div>

          {/* quality HUD */}
          {quality && phase === "review" && <QualityHud quality={quality} />}

          {phase === "idle" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => startCapture(false)} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-400 px-3 py-2.5 text-sm font-bold text-slate-950 transition active:scale-[0.98]">
                <ScanLine className="h-4 w-4" /> Capture Sheet
              </button>
              <button onClick={() => startCapture(true)} className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm font-bold text-amber-300 transition active:scale-[0.98] hover:bg-amber-500/20">
                <AlertTriangle className="h-4 w-4" /> Simulate Blurred
              </button>
            </div>
          )}
          {phase === "scanning" && (
            <button disabled className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-bold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing edges &amp; hashing bytes...
            </button>
          )}
        </div>

        {/* on-device hash */}
        {imageHash && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
            <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
              <Hash className="h-3.5 w-3.5" /> On-device SHA-256 {hashing ? "(computing)" : "(computed)"}
            </p>
            <p className="break-all font-mono text-[11px] text-cyan-200">{imageHash}</p>
          </div>
        )}
      </section>

      {/* ---------------- Side-by-side verification ---------------- */}
      <section className="space-y-4">
        <AnimatePresence mode="wait">
          {phase !== "review" ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center"
            >
              <div className="max-w-sm space-y-3">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-700 bg-slate-800">
                  <Crosshair className="h-7 w-7 text-slate-500" />
                </div>
                <h3 className="text-base font-bold text-slate-200">Awaiting capture</h3>
                <p className="text-sm text-slate-500">
                  Capture a Form EC8A to unlock the side-by-side OCR verification panel. Tap any extracted field to zoom into that region of the sheet.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                {/* image inspector */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Source Sheet Inspector</h3>
                    <span className="font-mono text-[10px] text-slate-500">{shortHash(imageHash)}</span>
                  </div>
                  <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    <img src={imageUrl} alt="EC8A" className="w-full" style={{ transform: selectedField ? "scale(1.9)" : "scale(1)", transformOrigin: selectedField ? `${ocrFields.find((f) => f.key === selectedField)?.box.x ?? 50}% ${ocrFields.find((f) => f.key === selectedField)?.box.y ?? 50}%` : "center", transition: "transform 0.4s ease" }} />
                    {ocrFields.map((f) => {
                      const active = selectedField === f.key;
                      const low = f.confidence < 85;
                      return (
                        <button
                          key={f.key}
                          onClick={() => setSelectedField(active ? null : f.key)}
                          className={`absolute rounded-sm border-2 transition ${
                            active
                              ? "border-cyan-400 bg-cyan-400/20 shadow-[0_0_12px_2px] shadow-cyan-500/40"
                              : low
                              ? "border-amber-500/70 bg-amber-500/10"
                              : "border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/15"
                          }`}
                          style={{ left: `${f.box.x}%`, top: `${f.box.y}%`, width: `${f.box.w}%`, height: `${f.box.h}%` }}
                          title={`${f.label}: ${f.value} (${f.confidence}%)`}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-2 text-center text-[10px] text-slate-500">Tap a highlighted region to zoom. Amber = low OCR confidence.</p>
                </div>

                {/* editable form */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Extracted &amp; Editable Fields</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(["registeredVoters", "accreditedVoters", "ballotIssued", "unusedBallots", "spoiledBallots", "rejectedVotes", "validVotes"] as const).map((k) => (
                      <NumField key={k} label={LABELS[k]} value={form[k]} onChange={(v) => updateField(k, v)} />
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Party Scores</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PARTIES.map((p) => (
                        <div key={p.code}>
                          <label className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold" style={{ color: p.color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />{p.code}
                          </label>
                          <input
                            type="number"
                            value={form.partyScores[p.code] ?? 0}
                            onChange={(e) => updateScore(p.code, +e.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-xs text-slate-100 outline-none focus:border-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-xs">
                      <span className="text-slate-400">Party sum vs Total valid</span>
                      <span className={`font-mono font-bold ${partySum === form.validVotes ? "text-emerald-400" : "text-rose-400"}`}>{partySum} / {form.validVotes}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* V1-V7 live auditor */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <Gauge className="h-4 w-4 text-emerald-400" /> Live Rule Auditor (V1-V7)
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${validation.passed ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                    {validation.passed ? "ALL RULES PASS" : `${validation.failingCount} ISSUE${validation.failingCount > 1 ? "S" : ""}`}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {validation.results.map((r) => (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                        r.passed ? "border-emerald-500/20 bg-emerald-500/5" : r.severity === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-rose-500/30 bg-rose-500/5"
                      }`}
                    >
                      {r.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : r.severity === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-200">
                          <span className="font-mono text-slate-500">{r.id}</span> {r.label}
                        </p>
                        <p className="text-[11px] leading-snug text-slate-400">{r.message}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* offline banner + commit */}
              {!store.online && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-xs text-amber-200">
                    Device is offline. Sheet hashed &amp; stored in encrypted local queue. Will auto-sync when network returns.
                  </p>
                </div>
              )}
              <button
                onClick={commitSubmission}
                disabled={!validation.passed && validation.results.some((r) => r.severity === "error")}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.99] ${
                  !validation.passed && validation.results.some((r) => r.severity === "error")
                    ? "cursor-not-allowed bg-slate-800 text-slate-500"
                    : store.online
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:brightness-110"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110"
                }`}
              >
                <Zap className="h-4 w-4" />
                {store.online ? "Commit to Ledger" : "Stash in Offline Queue"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <ReceiptModal receipt={receipt} onClose={() => { setReceipt(null); setPhase("idle"); }} store={store} />
    </div>
  );
}

const LABELS: Record<string, string> = {
  registeredVoters: "Registered Voters",
  accreditedVoters: "Accredited Voters",
  ballotIssued: "Ballots Issued",
  unusedBallots: "Unused Ballots",
  spoiledBallots: "Spoiled Ballots",
  rejectedVotes: "Rejected Votes",
  validVotes: "Total Valid Votes",
};

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-emerald-500"
      />
    </label>
  );
}

function GuideOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[{ top: "8%", label: "HEADER" }, { top: "34%", label: "BALLOT ACCOUNTING" }, { top: "60%", label: "PARTY SCORES" }].map((g) => (
        <div key={g.label} className="absolute left-3 right-3 rounded border border-dashed border-emerald-500/30" style={{ top: g.top, height: "18%" }}>
          <span className="absolute -top-2 left-2 rounded bg-slate-950 px-1 font-mono text-[8px] uppercase tracking-widest text-emerald-500/70">{g.label}</span>
        </div>
      ))}
      {/* 4-corner indicators */}
      {["left-2 top-2 border-l-2 border-t-2", "right-2 top-2 border-r-2 border-t-2", "left-2 bottom-2 border-b-2 border-l-2", "right-2 bottom-2 border-b-2 border-r-2"].map((c) => (
        <div key={c} className={`absolute h-6 w-6 border-emerald-400 ${c}`} />
      ))}
    </div>
  );
}

function IdleViewfinder({ form }: { form: EC8AFormData }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-950">
      <img src={makeEC8ASvg(form)} alt="preview" className="h-full w-full object-contain opacity-40 blur-[1px]" />
      <div className="absolute inset-0 grid place-items-center">
        <p className="rounded-full bg-slate-950/80 px-3 py-1 text-[11px] font-semibold text-slate-400">Frame the EC8A sheet inside the guides</p>
      </div>
    </div>
  );
}

function ScanningOverlay({ form }: { form: EC8AFormData }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      <img src={makeEC8ASvg(form)} alt="scanning" className="h-full w-full object-contain opacity-30" />
      <motion.div
        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_4px] shadow-emerald-500/50"
        initial={{ top: "4%" }}
        animate={{ top: ["4%", "94%", "4%"] }}
        transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-3 py-1.5">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-300">Hold steady — detecting edges</span>
        </div>
      </div>
    </div>
  );
}

function QualityHud({ quality }: { quality: QualityReport }) {
  const items = [
    { label: "Resolution", value: quality.resolutionOk ? quality.resolutionLabel : "LOW", ok: quality.resolutionOk },
    { label: "Sharpness", value: `${quality.sharpness}%`, ok: quality.sharpness >= 70 },
    { label: "Perspective", value: `${quality.perspective}%`, ok: quality.perspective >= 70 },
    { label: "Glare", value: `${quality.glare}%`, ok: quality.glare < 25 },
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={`rounded-lg border px-2 py-1.5 ${it.ok ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{it.label}</p>
          <p className={`flex items-center gap-1 font-mono text-xs font-bold ${it.ok ? "text-emerald-300" : "text-amber-300"}`}>
            {it.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReceiptModal({ receipt, onClose, store }: { receipt: Submission | null; onClose: () => void; store: ElectionStore }) {
  return (
    <AnimatePresence>
      {receipt && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl"
          >
            <div className="border-b border-slate-800 bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 p-4 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border-2 border-emerald-400/60 bg-emerald-500/10">
                <Fingerprint className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="mt-2 text-sm font-bold text-slate-100">Form EC8A Verification Seal</h3>
              <p className="text-[11px] text-slate-400">Cryptographic agent receipt</p>
            </div>
            <div className="space-y-2 p-4">
              <Row k="Reference ID" v={receipt.refId} mono />
              <Row k="Polling Unit" v={`${receipt.puCode} — ${receipt.puName}`} />
              <Row k="Agent" v={receipt.agentName} />
              <Row k="Image SHA-256" v={shortHash(receipt.imageHash, 16, 12)} mono />
              <Row k="Timestamp" v={new Date(receipt.capturedAt).toLocaleString()} />
              <Row k="Device Signature" v={shortHash(receipt.imageHash + receipt.refId, 12, 10)} mono />
              <Row k="Ledger Sequence" v={receipt.ledgerIndex != null ? `Block #${receipt.ledgerIndex}` : "Pending sync"} mono />
              <Row k="Status" v={receipt.status === "queued" ? "Encrypted in offline queue" : "Committed to ledger"} />

              {/* QR preview */}
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <QrGlyph seed={receipt.refId} />
                <p className="text-[11px] leading-snug text-slate-400">
                  Scan to anchor this receipt against the public ledger. Hash-chained &amp; tamper-evident.
                </p>
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-800 p-3">
              <button onClick={() => downloadReceipt(receipt)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700">
                <Download className="h-4 w-4" /> Download
              </button>
              <button onClick={() => { navigator.clipboard?.writeText(`${receipt.refId} ${receipt.imageHash}`); }} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700">
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button onClick={onClose} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 hover:brightness-110">
                <ChevronRight className="h-4 w-4" /> Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</span>
      <span className={`text-right text-xs text-slate-200 ${mono ? "font-mono" : ""}`}>{v}</span>
    </div>
  );
}

function QrGlyph({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const n = 21;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
    const out: boolean[] = [];
    for (let i = 0; i < n * n; i++) {
      h = Math.imul(h ^ (i + 7), 16777619) >>> 0;
      out.push((h & 0xff) > 110);
    }
    return out;
  }, [seed]);
  const n = 21;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-16 w-16 shrink-0 rounded bg-white p-1">
      {cells.map((on, i) => {
        const x = i % n, y = Math.floor(i / n);
        const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
        if (finder) return null;
        return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#0f172a" /> : null;
      })}
      {[[0, 0], [n - 7, 0], [0, n - 7]].map(([fx, fy], i) => (
        <g key={i}>
          <rect x={fx} y={fy} width={7} height={7} fill="none" stroke="#0f172a" strokeWidth={1} />
          <rect x={fx + 2} y={fy + 2} width={3} height={3} fill="#0f172a" />
        </g>
      ))}
    </svg>
  );
}

function downloadReceipt(s: Submission) {
  const blob = new Blob([JSON.stringify({
    referenceId: s.refId,
    puCode: s.puCode,
    agent: s.agentName,
    imageHash: s.imageHash,
    timestamp: s.capturedAt,
    status: s.status,
    form: s.form,
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EC8A-receipt-${s.refId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}