// ============================================================================
// Seed data: parties, personas, INEC polling-unit register, EC8A SVG sheet
// generator, and initial submissions across varied validation states.
// ============================================================================
import type {
  EC8AFormData,
  INECPollingUnit,
  Party,
  Persona,
  Submission,
} from "@/types/election";
import {
  makeRefId,
  simulateOCRExtraction,
  simulateQualityAnalysis,
  validateEC8ARules,
} from "@/utils/cryptoAndRules";

export const PARTIES: Party[] = [
  { code: "APC", name: "All Progressives Congress", color: "#10B981" },
  { code: "LP", name: "Labour Party", color: "#EF4444" },
  { code: "NNPP", name: "New Nigeria Peoples Party", color: "#F59E0B" },
  { code: "PDP", name: "Peoples Democratic Party", color: "#06B6D4" },
  { code: "ADC", name: "African Democratic Congress", color: "#8B5CF6" },
  { code: "APGA", name: "Action Alliance", color: "#EC4899" },
];

export const PERSONAS: Persona[] = [
  { id: "p-agent", name: "Chidi Okonkwo", role: "agent", title: "Field Agent", initials: "CO", party: "LP", puCode: "LAG/07/012", lga: "Ikeja", phone: "+234 803 111 2201" },
  { id: "p-coord", name: "Fatima Bello", role: "coordinator", title: "LGA Party Coordinator", initials: "FB", party: "APC", lga: "Alimosho", phone: "+234 805 222 3302" },
  { id: "p-rev", name: "Tunde Adeyemi", role: "reviewer", title: "Senior Reviewer", initials: "TA", phone: "+234 806 333 4403" },
  { id: "p-obs", name: "Ngozi Eze", role: "observer", title: "Election Observer / Media", initials: "NE", phone: "+234 807 444 5504" },
  { id: "p-admin", name: "Musa Ibrahim", role: "admin", title: "INEC System Admin", initials: "MI", phone: "+234 808 555 6605" },
  { id: "p-aud", name: "Okafor Nwosu", role: "auditor", title: "Cryptographic Auditor", initials: "ON", phone: "+234 809 666 7706" },
];

export const POLLING_UNITS: INECPollingUnit[] = [
  { code: "LAG/07/012", name: "Government Station Primary School", ward: "Ward 03", lga: "Ikeja", state: "Lagos", registeredVoters: 620, latitude: 6.6018, longitude: 3.3515, assignedAgent: "Chidi Okonkwo", party: "LP", active: true },
  { code: "LAG/20/045", name: "Alimosho Hall A", ward: "Ward 08", lga: "Alimosho", state: "Lagos", registeredVoters: 540, latitude: 6.6291, longitude: 3.3401, assignedAgent: "Fatima Bello", party: "APC", active: true },
  { code: "LAG/01/007", name: "Lagos Island Civic Centre", ward: "Ward 01", lga: "Lagos Island", state: "Lagos", registeredVoters: 710, latitude: 6.4281, longitude: 3.4219, assignedAgent: "Bola Tinubu", party: "PDP", active: true },
  { code: "KAN/04/031", name: "Nasarawa Central Mosque Hall", ward: "Ward 05", lga: "Nasarawa", state: "Kano", registeredVoters: 480, latitude: 12.0022, longitude: 8.5920, assignedAgent: "Aminu Kano", party: "NNPP", active: true },
  { code: "KAN/16/022", name: "Dala Ward Unit 2", ward: "Ward 02", lga: "Dala", state: "Kano", registeredVoters: 395, latitude: 11.9910, longitude: 8.5400, assignedAgent: "Sadiq Umar", party: "APC", active: true },
  { code: "RIV/02/018", name: "Port Harcourt Town Hall", ward: "Ward 04", lga: "Port Harcourt", state: "Rivers", registeredVoters: 655, latitude: 4.8156, longitude: 7.0497, assignedAgent: "Ebi Ware", party: "PDP", active: true },
  { code: "FCT/01/009", name: "AMAC Secretariat Annex", ward: "Ward 01", lga: "AMAC", state: "FCT", registeredVoters: 820, latitude: 9.0579, longitude: 7.4951, assignedAgent: "Yakubu Danjuma", party: "APC", active: true },
  { code: "FCT/01/014", name: "Garki Market Square", ward: "Ward 06", lga: "AMAC", state: "FCT", registeredVoters: 512, latitude: 9.0701, longitude: 7.4900, assignedAgent: "Aisha Lawal", party: "LP", active: true },
];

export function puByCode(code: string): INECPollingUnit | undefined {
  return POLLING_UNITS.find((p) => p.code === code);
}

// ---------------------------------------------------------------------------
// EC8A sheet SVG mockup generator (source-of-truth photo stand-in)
// ---------------------------------------------------------------------------
export function makeEC8ASvg(form: EC8AFormData, opts?: { lowQuality?: boolean; tampered?: boolean }): string {
  const rows = Object.entries(form.partyScores)
    .map(
      ([code, votes], i) => `
      <g transform="translate(28 ${360 + i * 34})">
        <rect x="0" y="0" width="344" height="30" fill="${i % 2 ? "#f1f5f9" : "#ffffff"}" stroke="#cbd5e1" stroke-width="0.6"/>
        <text x="10" y="20" font-family="monospace" font-size="15" fill="#0f172a">${code}</text>
        <text x="150" y="20" font-family="monospace" font-size="15" text-anchor="end" fill="${opts?.tampered && code === "APC" ? "#dc2626" : "#0f172a"}">${opts?.tampered && code === "APC" ? votes + 7 : votes}</text>
      </g>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <defs><filter id="b"><feGaussianBlur stdDeviation="${opts?.lowQuality ? 1.1 : 0}"/></filter></defs>
    <rect width="400" height="600" fill="#fdfdfb"/>
    <g filter="url(#b)">
      <rect x="16" y="16" width="368" height="568" fill="none" stroke="#0f172a" stroke-width="1.4"/>
      <text x="200" y="44" font-family="sans-serif" font-size="16" font-weight="700" text-anchor="middle" fill="#0f172a">FORM EC8A</text>
      <text x="200" y="62" font-family="sans-serif" font-size="10" text-anchor="middle" fill="#475569">INEC RECORD OF VOTES AT A POLLING UNIT</text>
      <line x1="16" y1="72" x2="384" y2="72" stroke="#0f172a" stroke-width="1"/>
      <text x="28" y="94" font-family="monospace" font-size="11" fill="#0f172a">PU CODE: ${form.puCode}</text>
      <text x="28" y="112" font-family="monospace" font-size="11" fill="#334155">${form.puName}</text>
      <text x="28" y="130" font-family="monospace" font-size="10" fill="#334155">${form.state} / ${form.lga} / ${form.ward}</text>
      <text x="28" y="162" font-family="sans-serif" font-size="11" font-weight="700" fill="#0f172a">A. BALLOT ACCOUNTING</text>
      <text x="28" y="182" font-family="monospace" font-size="11" fill="#0f172a">Registered: ${form.registeredVoters}</text>
      <text x="210" y="182" font-family="monospace" font-size="11" fill="#0f172a">Accredited: ${form.accreditedVoters}</text>
      <text x="28" y="200" font-family="monospace" font-size="11" fill="#0f172a">Issued: ${form.ballotIssued}</text>
      <text x="210" y="200" font-family="monospace" font-size="11" fill="#0f172a">Unused: ${form.unusedBallots}</text>
      <text x="28" y="218" font-family="monospace" font-size="11" fill="#0f172a">Spoiled: ${form.spoiledBallots}</text>
      <text x="210" y="218" font-family="monospace" font-size="11" fill="#0f172a">Rejected: ${form.rejectedVotes}</text>
      <text x="28" y="244" font-family="monospace" font-size="12" font-weight="700" fill="#0f172a">TOTAL VALID: ${form.validVotes}</text>
      <line x1="16" y1="256" x2="384" y2="256" stroke="#0f172a" stroke-width="1"/>
      <text x="28" y="280" font-family="sans-serif" font-size="11" font-weight="700" fill="#0f172a">B. VOTES SCORED PER POLITICAL PARTY</text>
      <g transform="translate(0 0)">${rows}</g>
      <circle cx="330" cy="540" r="34" fill="none" stroke="#1e3a8a" stroke-width="2" opacity="0.7"/>
      <text x="330" y="536" font-family="sans-serif" font-size="7" text-anchor="middle" fill="#1e3a8a" opacity="0.85">INEC</text>
      <text x="330" y="548" font-family="sans-serif" font-size="7" text-anchor="middle" fill="#1e3a8a" opacity="0.85">SEAL</text>
    </g>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------
// Build a fully-hydrated Submission from a form + modifiers
// ---------------------------------------------------------------------------
export function buildSubmission(
  form: EC8AFormData,
  meta: {
    agent: string;
    party: string;
    status: Submission["status"];
    capturedAt: number;
    gpsOffsetMeters?: number;
    lowQuality?: boolean;
    lowConfidence?: boolean;
    tamperSum?: boolean;
  }
): Submission {
  const pu = puByCode(form.puCode);
  const quality = simulateQualityAnalysis(form.puCode, meta.lowQuality);
  const ocrFields = simulateOCRExtraction(form, form.puCode, meta.lowConfidence);
  const agentGps = {
    lat: (pu?.latitude ?? 9) + (meta.gpsOffsetMeters ?? 0) / 111000,
    lng: (pu?.longitude ?? 7) + (meta.gpsOffsetMeters ?? 0) / 85000,
  };
  const puGps = { lat: pu?.latitude ?? 9, lng: pu?.longitude ?? 7 };
  const validation = validateEC8ARules(form, quality, agentGps, puGps, form.puCode);
  const seedKey = form.puCode + meta.capturedAt;
  return {
    id: `sub-${form.puCode}-${meta.capturedAt}`,
    refId: makeRefId(form.puCode, seedKey),
    puCode: form.puCode,
    puName: form.puName,
    state: form.state,
    lga: form.lga,
    ward: form.ward,
    party: meta.party,
    agentName: meta.agent,
    form,
    imageUrl: makeEC8ASvg(form, { lowQuality: meta.lowQuality }),
    imageHash: "",
    ocrFields,
    quality,
    validation,
    status: meta.status,
    gps: agentGps,
    capturedAt: meta.capturedAt,
    attempts: meta.status === "queued" ? 2 : 0,
  };
}

const day = 86_400_000;
const now = Date.now();

function form(partial: Partial<EC8AFormData> & Pick<EC8AFormData, "puCode" | "puName" | "state" | "lga" | "ward">, scores: Record<string, number>): EC8AFormData {
  return {
    registeredVoters: 600,
    accreditedVoters: 380,
    ballotIssued: 380,
    unusedBallots: 12,
    spoiledBallots: 3,
    rejectedVotes: 7,
    validVotes: 358,
    totalVotesCast: 365,
    partyScores: scores,
    ...partial,
  } as EC8AFormData;
}

export const SEED_SUBMISSIONS: Submission[] = [
  buildSubmission(
    form({ puCode: "LAG/07/012", puName: "Government Station Primary School", state: "Lagos", lga: "Ikeja", ward: "Ward 03", registeredVoters: 620, accreditedVoters: 402, ballotIssued: 402, unusedBallots: 14, spoiledBallots: 4, rejectedVotes: 6, validVotes: 378 }, { APC: 150, LP: 140, NNPP: 58, PDP: 30, ADC: 0, APGA: 0 }),
    { agent: "Chidi Okonkwo", party: "LP", status: "verified", capturedAt: now - 5 * day }
  ),
  buildSubmission(
    form({ puCode: "KAN/04/031", puName: "Nasarawa Central Mosque Hall", state: "Kano", lga: "Nasarawa", ward: "Ward 05", registeredVoters: 480, accreditedVoters: 300, ballotIssued: 300, unusedBallots: 8, spoiledBallots: 2, rejectedVotes: 5, validVotes: 285 }, { APC: 90, LP: 40, NNPP: 130, PDP: 20, ADC: 0, APGA: 0 }),
    { agent: "Aminu Kano", party: "NNPP", status: "verified", capturedAt: now - 4 * day }
  ),
  buildSubmission(
    form({ puCode: "RIV/02/018", puName: "Port Harcourt Town Hall", state: "Rivers", lga: "Port Harcourt", ward: "Ward 04", registeredVoters: 655, accreditedVoters: 430, ballotIssued: 430, unusedBallots: 10, spoiledBallots: 3, rejectedVotes: 8, validVotes: 409 }, { APC: 120, LP: 180, NNPP: 60, PDP: 40, ADC: 5, APGA: 4 }),
    { agent: "Ebi Ware", party: "PDP", status: "pending_review", capturedAt: now - 3 * day, lowConfidence: true }
  ),
  buildSubmission(
    form({ puCode: "FCT/01/009", puName: "AMAC Secretariat Annex", state: "FCT", lga: "AMAC", ward: "Ward 01", registeredVoters: 820, accreditedVoters: 510, ballotIssued: 510, unusedBallots: 20, spoiledBallots: 5, rejectedVotes: 10, validVotes: 475 }, { APC: 210, LP: 150, NNPP: 70, PDP: 30, ADC: 10, APGA: 5 }),
    { agent: "Yakubu Danjuma", party: "APC", status: "flagged", capturedAt: now - 2 * day, gpsOffsetMeters: 1400 }
  ),
  buildSubmission(
    form({ puCode: "FCT/01/014", puName: "Garki Market Square", state: "FCT", lga: "AMAC", ward: "Ward 06", registeredVoters: 512, accreditedVoters: 320, ballotIssued: 320, unusedBallots: 9, spoiledBallots: 2, rejectedVotes: 4, validVotes: 305 }, { APC: 100, LP: 160, NNPP: 30, PDP: 15, ADC: 0, APGA: 0 }),
    { agent: "Aisha Lawal", party: "LP", status: "queued", capturedAt: now - 1 * day, lowQuality: true }
  ),
  buildSubmission(
    form({ puCode: "LAG/20/045", puName: "Alimosho Hall A", state: "Lagos", lga: "Alimosho", ward: "Ward 08", registeredVoters: 540, accreditedVoters: 360, ballotIssued: 360, unusedBallots: 11, spoiledBallots: 3, rejectedVotes: 6, validVotes: 340 }, { APC: 160, LP: 90, NNPP: 50, PDP: 30, ADC: 6, APGA: 4 }),
    { agent: "Fatima Bello", party: "APC", status: "verified", capturedAt: now - 6 * day }
  ),
];

export const STATE_LIST = Array.from(new Set(POLLING_UNITS.map((p) => p.state)));
