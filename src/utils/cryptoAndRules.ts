// ============================================================================
// Web Crypto SHA-256, V1-V7 rule engine, OCR + quality simulators,
// and the append-only hash-chain ledger auditor.
// ============================================================================
import type {
  EC8AFormData,
  GpsPoint,
  LedgerBlock,
  OCRField,
  QualityReport,
  RuleResult,
  RuleValidation,
  Submission,
} from "@/types/election";

// ---- SHA-256 -------------------------------------------------------------
function toBytes(data: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return data;
}

function fallbackHash(bytes: Uint8Array): string {
  // Deterministic non-crypto fallback for insecure contexts (offline demo).
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0xdeadbeef;
  let h4 = 0xcafebabe;
  const state = [h1, h2, h3, h4];
  for (let i = 0; i < bytes.length; i++) {
    const j = i % 4;
    state[j] = Math.imul(state[j] ^ bytes[i], 16777619) >>> 0;
    state[(j + 1) % 4] = (state[(j + 1) % 4] + state[j]) >>> 0;
  }
  return state.map((s) => s.toString(16).padStart(8, "0")).join("").repeat(8).slice(0, 64);
}

export async function computeSHA256(
  data: string | Uint8Array | ArrayBuffer
): Promise<string> {
  const bytes = toBytes(data);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    try {
      const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return fallbackHash(bytes);
    }
  }
  return fallbackHash(bytes);
}

export function shortHash(hash: string, head = 10, tail = 8): string {
  if (!hash || hash.length <= head + tail + 3) return hash || "";
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

// ---- Ledger chain --------------------------------------------------------
export async function computeChainedBlockHash(
  prevHash: string,
  payloadHash: string,
  timestamp: number,
  entryType: string
): Promise<string> {
  return computeSHA256(`${prevHash}|${payloadHash}|${timestamp}|${entryType}`);
}

export async function payloadHashForSubmission(s: Submission): Promise<string> {
  const canonical = JSON.stringify({
    refId: s.refId,
    puCode: s.puCode,
    form: s.form,
    imageHash: s.imageHash,
    status: s.status,
  });
  return computeSHA256(canonical);
}

export async function buildLedgerFromSubmissions(
  subs: Submission[]
): Promise<LedgerBlock[]> {
  const blocks: LedgerBlock[] = [];
  let prevHash = "0".repeat(64);
  const ordered = [...subs].sort((a, b) => a.capturedAt - b.capturedAt);
  for (const s of ordered) {
    const payloadHash = await payloadHashForSubmission(s);
    const entryType =
      s.status === "superseded" ? "SUPERSEDING_RECORD" : "INITIAL_SUBMISSION";
    const timestamp = s.capturedAt;
    const blockHash = await computeChainedBlockHash(
      prevHash,
      payloadHash,
      timestamp,
      entryType
    );
    blocks.push({
      index: blocks.length,
      timestamp,
      prevHash,
      payloadHash,
      blockHash,
      entryType,
      submissionId: s.id,
      refId: s.refId,
      agentSignature: (s.imageHash + s.refId).slice(0, 48),
    });
    prevHash = blockHash;
  }
  return blocks;
}

export async function appendLedgerBlock(
  chain: LedgerBlock[],
  s: Submission,
  entryType: LedgerBlock["entryType"],
  supersedesId?: string
): Promise<LedgerBlock> {
  const prevHash =
    chain.length > 0 ? chain[chain.length - 1].blockHash : "0".repeat(64);
  const payloadHash = await payloadHashForSubmission(s);
  const timestamp = Date.now();
  const blockHash = await computeChainedBlockHash(
    prevHash,
    payloadHash,
    timestamp,
    entryType
  );
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
    supersedesId,
  };
}

export async function verifyFullLedgerChain(
  chain: LedgerBlock[]
): Promise<{ isValid: boolean; brokenAtIndex: number | null }> {
  let prevHash = "0".repeat(64);
  for (const b of chain) {
    const recomputed = await computeChainedBlockHash(
      prevHash,
      b.payloadHash,
      b.timestamp,
      b.entryType
    );
    if (b.prevHash !== prevHash || b.blockHash !== recomputed || b.tampered) {
      return { isValid: false, brokenAtIndex: b.index };
    }
    prevHash = b.blockHash;
  }
  return { isValid: true, brokenAtIndex: null };
}

// ---- Geo -----------------------------------------------------------------
function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// ---- V1-V7 rule engine ---------------------------------------------------
export function validateEC8ARules(
  data: EC8AFormData,
  quality: QualityReport,
  agentGps: GpsPoint,
  puGps: GpsPoint,
  registerCode: string
): RuleValidation {
  const results: RuleResult[] = [];
  const partySum = Object.values(data.partyScores).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );
  const ballotsUsed =
    data.ballotIssued - data.unusedBallots - data.spoiledBallots;

  // V1 PU code match
  const v1 = data.puCode.trim().toUpperCase() === registerCode.trim().toUpperCase();
  results.push({
    id: "V1",
    label: "Polling Unit Code Match",
    passed: v1,
    severity: v1 ? "ok" : "error",
    message: v1
      ? `PU code ${data.puCode} matches the INEC register.`
      : `PU code ${data.puCode} does not match register ${registerCode}.`,
  });

  // V2 party sum == valid votes
  const v2 = partySum === data.validVotes;
  results.push({
    id: "V2",
    label: "Party Scores Sum = Total Valid Votes",
    passed: v2,
    severity: v2 ? "ok" : "error",
    message: v2
      ? `Party votes sum to ${partySum}, equal to total valid votes.`
      : `Party votes sum to ${partySum}, but Total Valid Votes is ${data.validVotes}. Discrepancy: ${partySum - data.validVotes > 0 ? "+" : ""}${partySum - data.validVotes}.`,
  });

  // V3 valid + rejected == ballots used
  const v3 = data.validVotes + data.rejectedVotes === ballotsUsed;
  results.push({
    id: "V3",
    label: "Valid + Rejected = Ballots Used",
    passed: v3,
    severity: v3 ? "ok" : "error",
    message: v3
      ? `Valid (${data.validVotes}) + Rejected (${data.rejectedVotes}) equals ballots used (${ballotsUsed}).`
      : `Valid (${data.validVotes}) + Rejected (${data.rejectedVotes}) = ${data.validVotes + data.rejectedVotes}, but ballots used = ${ballotsUsed}.`,
  });

  // V4 accredited <= registered
  const v4 = data.accreditedVoters <= data.registeredVoters;
  results.push({
    id: "V4",
    label: "Accredited Voters <= Registered Voters",
    passed: v4,
    severity: v4 ? "ok" : "error",
    message: v4
      ? `Accredited ${data.accreditedVoters} is within registered ${data.registeredVoters}.`
      : `Accredited voters (${data.accreditedVoters}) exceed registered voters (${data.registeredVoters}).`,
  });

  // V5 required numeric non-null
  const required: Array<[string, number]> = [
    ["Registered Voters", data.registeredVoters],
    ["Accredited Voters", data.accreditedVoters],
    ["Ballots Issued", data.ballotIssued],
    ["Valid Votes", data.validVotes],
    ["Rejected Votes", data.rejectedVotes],
  ];
  const missing = required.filter(
    ([, v]) => v === null || v === undefined || Number.isNaN(v)
  );
  const v5 = missing.length === 0;
  results.push({
    id: "V5",
    label: "Mandatory Numeric Fields Present",
    passed: v5,
    severity: v5 ? "ok" : "error",
    message: v5
      ? "All mandatory numeric fields are present."
      : `Missing or invalid fields: ${missing.map(([n]) => n).join(", ")}.`,
  });

  // V6 quality >= 70
  const v6 = quality.overall >= 70;
  results.push({
    id: "V6",
    label: "Image Quality & Clarity",
    passed: v6,
    severity: v6 ? "ok" : "warn",
    message: v6
      ? `Clarity score ${quality.overall}% meets the 70% threshold.`
      : `Clarity score ${quality.overall}% is below the 70% threshold. Recapture recommended.`,
  });

  // V7 GPS proximity within 500m
  const dist = haversineMeters(agentGps, puGps);
  const v7 = dist <= 500;
  results.push({
    id: "V7",
    label: "GPS Proximity to Polling Unit",
    passed: v7,
    severity: v7 ? "ok" : "warn",
    message: v7
      ? `Device located ${dist}m from registered PU coordinates.`
      : `Device is ${dist}m from PU coordinates, exceeding the 500m geofence.`,
  });

  const failingCount = results.filter((r) => !r.passed).length;
  return { results, passed: failingCount === 0, failingCount };
}

// ---- Deterministic pseudo-random from seed ------------------------------
function seeded(seed: string, salt: string): number {
  let h = 2166136261;
  const s = seed + "|" + salt;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  return (h % 10000) / 10000; // 0..1
}

// ---- OCR simulator -------------------------------------------------------
export function simulateOCRExtraction(
  form: EC8AFormData,
  seedKey: string,
  forceLowConfidence = false
): OCRField[] {
  const base: Array<{ key: string; label: string; value: number; box: [number, number, number, number] }> = [
    { key: "registeredVoters", label: "Registered Voters", value: form.registeredVoters, box: [4, 20, 40, 6] },
    { key: "accreditedVoters", label: "Accredited Voters", value: form.accreditedVoters, box: [4, 27, 40, 6] },
    { key: "ballotIssued", label: "Ballots Issued", value: form.ballotIssued, box: [56, 20, 40, 6] },
    { key: "unusedBallots", label: "Unused Ballots", value: form.unusedBallots, box: [56, 27, 40, 6] },
    { key: "spoiledBallots", label: "Spoiled Ballots", value: form.spoiledBallots, box: [56, 34, 40, 6] },
    { key: "rejectedVotes", label: "Rejected Votes", value: form.rejectedVotes, box: [4, 44, 40, 6] },
    { key: "validVotes", label: "Total Valid Votes", value: form.validVotes, box: [4, 51, 40, 6] },
  ];
  const partyRows = Object.entries(form.partyScores);
  partyRows.forEach(([code, value], i) => {
    base.push({
      key: `party_${code}`,
      label: `${code} Votes`,
      value,
      box: [4, 62 + i * 5, 92, 4.4],
    });
  });

  return base.map((f, i) => {
    let conf = 94 + Math.round(seeded(seedKey, f.key) * 5); // 94-99
    if (forceLowConfidence && (i === 3 || i === 6)) conf = 78 + Math.round(seeded(seedKey, f.key) * 6);
    return {
      key: f.key,
      label: f.label,
      value: f.value,
      confidence: conf,
      box: { x: f.box[0], y: f.box[1], w: f.box[2], h: f.box[3] },
    };
  });
}

// ---- Quality simulator ---------------------------------------------------
export function simulateQualityAnalysis(
  seedKey: string,
  forceLow = false
): QualityReport {
  const sharpness = forceLow
    ? 58 + Math.round(seeded(seedKey, "s") * 8)
    : 86 + Math.round(seeded(seedKey, "s") * 12);
  const perspective = forceLow
    ? 62 + Math.round(seeded(seedKey, "p") * 10)
    : 88 + Math.round(seeded(seedKey, "p") * 11);
  const glare = forceLow
    ? 34 + Math.round(seeded(seedKey, "g") * 12)
    : 6 + Math.round(seeded(seedKey, "g") * 10);
  const resolutionOk = true;
  const overall = Math.round(sharpness * 0.45 + perspective * 0.35 + (100 - glare) * 0.2);
  return {
    resolutionLabel: "1920 x 2560",
    resolutionOk,
    sharpness,
    perspective,
    glare,
    overall,
    passed: overall >= 70,
  };
}

export function makeRefId(puCode: string, seedKey: string): string {
  const suffix = Math.floor(seeded(seedKey, "ref") * 9000 + 1000);
  return `EC8A-${puCode}-${suffix}`;
}
