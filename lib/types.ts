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
}

export interface SessionState {
  setupId: string;
  vault: { assetsTotal: string; assetsAvailable: string; shareMptId?: string } | null;
  broker: { coverAvailable: string } | null;
  loans: LoanState[];
  seats: { key: string; occupant: OccupantKind; participant?: string }[];
}

// The five participant roles as presented in the UI. Vault manager and loan originator are two role
// surfaces on the single owner seat.
export type UiRole = "issuer" | "depositor" | "vault-manager" | "loan-originator" | "borrower";
