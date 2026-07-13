import type { SessionState, SessionSummary } from "./types";

// The single seam between the UI and the engine. Every component reads and acts through this
// interface. Today it is backed by an in-memory mock; binding to the live engine replaces the
// implementation only — the interface, and therefore every component, stays the same.

export interface ActionRequest {
  seat: string;
  action: string;
  params?: Record<string, string>;
}

export interface ActionResult {
  // The ledger engine result — "tesSUCCESS" on success, or a rejection code such as "tecNO_AUTH".
  code: string;
  hash?: string;
  // Whether the ledger accepted the action.
  ok: boolean;
}

// One entry in the session's append-only transaction log. Every attempted action — from the
// initial provisioning, the bots, or a human — produces an entry, whether it settled or was rejected.
export interface LogEntry {
  seq: number;
  ts: number; // epoch ms
  actor: string; // seat key, e.g. "depositor:0"
  role: string; // issuer | owner | depositor | borrower
  by: "human" | "bot" | "system"; // who drove it
  action: string; // human-readable action label
  code: string; // ledger result code, e.g. "tesSUCCESS" or "tecNO_AUTH"
  ok: boolean;
  hash?: string; // on-ledger transaction hash, present when it settled
  detail?: string; // e.g. "90,000 RLUSD"
}

export interface ProvisionRequest {
  label?: string;
  asset?: string;
  depositors?: number;
  borrowers?: number;
  coverAmount?: string;
  paymentInterval?: number;
  scenario?: string;
  // Broker configuration overrides (percentages and whole-unit amounts).
  coverRatePercent?: number;
  liquidationRatePercent?: number;
  managementFeePercent?: number;
  debtMaximum?: string;
}

// One provisioning step reported while a session is being created: an on-ledger action, its result,
// and — when it settled — its transaction hash. A skipped step is one whose object already existed.
export interface ProvisionStep {
  action: string;
  result: string;
  txHash?: string;
  skipped: boolean;
}

export interface EngineClient {
  // Creates a session. When onStep is provided and the backend supports streaming, it is called with
  // each provisioning step as it settles; otherwise it may simply not be called and the summary is
  // returned when provisioning completes.
  createSession(req: ProvisionRequest, onStep?: (step: ProvisionStep) => void): Promise<SessionSummary>;
  getSession(setupId: string): Promise<SessionSummary>;
  getState(setupId: string): Promise<SessionState>;
  getLog(setupId: string): Promise<LogEntry[]>;
  claimSeat(setupId: string, seat: string, participant: string): Promise<SessionSummary>;
  releaseSeat(setupId: string, seat: string, participant: string): Promise<SessionSummary>;
  // Grows a pooled role (depositor or borrower) by one bot participant: provisions and credentials a
  // new account and seats a bot on it. Only "depositor" and "borrower" are poolable — the issuer and
  // owner are single by the protocol. Returns the updated seat graph.
  addParticipant(setupId: string, role: "depositor" | "borrower"): Promise<SessionSummary>;
  act(setupId: string, participant: string, req: ActionRequest): Promise<ActionResult>;
  startBots(setupId: string): Promise<void>;
  stopBots(setupId: string): Promise<void>;
}
