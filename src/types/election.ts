// ============================================================================
// EC8A Offline-First Verification & Cryptographic Ledger — Data Contracts
// ============================================================================

export type UserRole =
  | "agent"
  | "coordinator"
  | "reviewer"
  | "observer"
  | "admin"
  | "auditor";

export interface Persona {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  initials: string;
  party?: string;
  puCode?: string;
  lga?: string;
  phone: string;
}

export interface Party {
  code: string;
  name: string;
  color: string;
}

export interface EC8AFormData {
  puCode: string;
  puName: string;
  state: string;
  lga: string;
  ward: string;
  registeredVoters: number;
  accreditedVoters: number;
  ballotIssued: number;
  unusedBallots: number;
  spoiledBallots: number;
  rejectedVotes: number;
  validVotes: number;
  totalVotesCast: number;
  partyScores: Record<string, number>;
}

export interface OcrBox {
  x: number; // percentage 0-100
  y: number;
  w: number;
  h: number;
}

export interface OCRField {
  key: string;
  label: string;
  value: number;
  confidence: number; // 0-100
  box: OcrBox;
}

export interface QualityReport {
  resolutionLabel: string;
  resolutionOk: boolean;
  sharpness: number; // 0-100 (Laplacian blur score normalized)
  perspective: number; // 0-100 (4-corner alignment)
  glare: number; // 0-100 (lower is better)
  overall: number; // 0-100 composite
  passed: boolean;
}

export type RuleSeverity = "ok" | "warn" | "error";

export interface RuleResult {
  id: string; // V1..V7
  label: string;
  passed: boolean;
  severity: RuleSeverity;
  message: string;
}

export interface RuleValidation {
  results: RuleResult[];
  passed: boolean;
  failingCount: number;
}

export type SubmissionStatus =
  | "verified"
  | "pending_review"
  | "queued"
  | "flagged"
  | "rejected"
  | "superseded";

export interface GpsPoint {
  lat: number;
  lng: number;
}

export interface Submission {
  id: string;
  refId: string;
  puCode: string;
  puName: string;
  state: string;
  lga: string;
  ward: string;
  party: string;
  agentName: string;
  form: EC8AFormData;
  imageUrl: string;
  imageHash: string;
  ocrFields: OCRField[];
  quality: QualityReport;
  validation: RuleValidation;
  status: SubmissionStatus;
  gps: GpsPoint;
  capturedAt: number;
  syncedAt?: number;
  ledgerIndex?: number;
  attempts: number;
  reviewNote?: string;
}

export type LedgerEntryType =
  | "INITIAL_SUBMISSION"
  | "REVIEWER_CORRECTION"
  | "SUPERSEDING_RECORD";

export interface LedgerBlock {
  index: number;
  timestamp: number;
  prevHash: string;
  payloadHash: string;
  blockHash: string;
  entryType: LedgerEntryType;
  submissionId: string;
  refId: string;
  agentSignature: string;
  supersedesId?: string;
  tampered?: boolean;
}

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueueItem {
  id: string;
  submissionId: string;
  refId: string;
  payloadHash: string;
  imageUrl: string;
  gps: GpsPoint;
  attempts: number;
  syncStatus: SyncStatus;
  queuedAt: number;
  lastError?: string;
  encryptedBlob: string;
}

export interface INECPollingUnit {
  code: string;
  name: string;
  ward: string;
  lga: string;
  state: string;
  registeredVoters: number;
  latitude: number;
  longitude: number;
  assignedAgent: string;
  party: string;
  active: boolean;
}

export type TabKey =
  | "capture"
  | "review"
  | "dashboard"
  | "party"
  | "ledger"
  | "admin";

export interface AuditBundle {
  generatedAt: number;
  manifest: {
    ledgerHeight: number;
    chainValid: boolean;
    submissions: number;
    verified: number;
    flagged: number;
  };
  blocks: LedgerBlock[];
  certificate: string;
}

// ---------------------------------------------------------------------------
// Central reactive store contract consumed by every screen.
// ---------------------------------------------------------------------------
export interface ElectionStore {
  // identity + network simulator
  role: UserRole;
  persona: Persona;
  personas: Persona[];
  online: boolean;
  activeTab: TabKey;

  // data
  pollingUnits: INECPollingUnit[];
  submissions: Submission[];
  ledger: LedgerBlock[];
  queue: QueueItem[];
  chainValid: boolean;
  chainBrokenAt: number | null;

  // ephemeral UI
  activeReceipt: Submission | null;
  inspectSubmission: Submission | null;

  // actions
  setRole: (role: UserRole) => void;
  setActiveTab: (tab: TabKey) => void;
  toggleOnline: () => void;
  syncAll: () => void;
  addSubmission: (s: Submission) => void;
  approveCorrection: (
    submissionId: string,
    corrected: EC8AFormData,
    note: string
  ) => void;
  rejectSubmission: (submissionId: string, note: string) => void;
  requestResubmit: (submissionId: string, note: string) => void;
  verifyChain: () => Promise<void>;
  simulateTamper: () => void;
  resetTamper: () => void;
  exportBundle: (filter: { state?: string; lga?: string; puCode?: string }) => AuditBundle;
  openReceipt: (s: Submission | null) => void;
  inspect: (s: Submission | null) => void;
  resetDemo: () => void;
}
