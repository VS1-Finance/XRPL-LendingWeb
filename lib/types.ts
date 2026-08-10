// Types mirror the engine API shapes, so the UI can move from mock data to live calls without
// changing its components.

export type OccupantKind = "open" | "bot" | "human";

export interface SeatSummary {
  key: string; // e.g. "depositor:0"
  role: string; // issuer | owner | depositor | borrower
  address: string;
  occupant: { kind: OccupantKind; id?: string };
}

// The deployment parameters a session was provisioned with, echoed back for display.
export interface SessionConfig {
  asset: string;
  coverAmount: string;
  paymentInterval: number;
  scenario: string;
}

export interface SessionSummary {
  setupId: string;
  network: string;
  // The vault asset ("XRP" or a currency code) and whether the vault is permissioned — both come
  // straight from the engine summary, which reads them from the provisioned environment.
  asset: string;
  permissioned: boolean;
  seats: SeatSummary[];
  openSeats: string[];
  config: SessionConfig;
}

export interface LoanState {
  loanId: string;
  borrower: string;
  principalOutstanding: string;
  totalOutstanding: string;
  paymentRemaining: number;
  defaulted: boolean;
  // Whether the loan can be defaulted right now (overdue past its grace period), and if not yet, how
  // many seconds until it can be. Optional so a state from an engine that predates the fields still
  // typechecks and is treated as "not defaultable / unknown".
  defaultableNow?: boolean;
  defaultableInSeconds?: number | null;
}

export interface SessionState {
  setupId: string;
  vault: { assetsTotal: string; assetsAvailable: string; shareMptId?: string; sharesTotal?: string; lossUnrealized?: string; scale?: number } | null;
  broker: { coverAvailable: string; debtTotal?: string; debtMaximum?: string; managementFeeRate?: number; coverRateMinimum?: number; coverRateLiquidation?: number } | null;
  loans: LoanState[];
  seats: { key: string; occupant: OccupantKind; participant?: string }[];
  // Credential status per participant account, so the UI can show the accept action only where a
  // credential is pending acceptance.
  credentials: { address: string; status: "accepted" | "pending" | "none" }[];
}

// The participant roles as presented in the UI. Vault manager and loan originator are two role
// surfaces on the single owner seat. Currency issuer and credential issuer are distinct accounts.
export type UiRole = "issuer" | "credential-issuer" | "depositor" | "vault-manager" | "loan-originator" | "borrower";
