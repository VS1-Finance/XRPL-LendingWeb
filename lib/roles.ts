import type { SeatSummary, UiRole } from "./types";

// The five participant roles as presented in the UI. The vault owner seat backs two of them — vault
// manager and loan originator — because on-ledger those actions must come from the same account.
export interface UiRoleDef {
  id: UiRole;
  label: string;
  // The seat role this UI role maps to.
  seatRole: string;
  description: string;
}

export const UI_ROLES: UiRoleDef[] = [
  { id: "issuer", label: "Credential Issuer", seatRole: "issuer", description: "Issues and revokes the credentials that grant access." },
  { id: "depositor", label: "Depositor", seatRole: "depositor", description: "Supplies liquidity to the vault and holds yield-bearing shares." },
  { id: "vault-manager", label: "Vault Manager", seatRole: "owner", description: "Configures the vault and the permissioned domain." },
  { id: "loan-originator", label: "Loan Originator", seatRole: "owner", description: "Originates loans against vault liquidity." },
  { id: "borrower", label: "Borrower", seatRole: "borrower", description: "Draws a loan and repays it over its term." },
];

export function roleForSeat(seatRole: string): UiRoleDef | undefined {
  // Owner seat is shown as vault manager (its two role surfaces are tabs within one panel).
  return UI_ROLES.find((r) => r.seatRole === seatRole);
}

// The numeric index encoded in a seat key, e.g. "depositor:1" -> 1.
export function seatIndex(seat: SeatSummary): number {
  return Number(seat.key.split(":")[1] ?? 0);
}

// A readable label for a seat, e.g. "Depositor 1".
export function seatLabel(seat: SeatSummary): string {
  return seatLabelForKey(seat.key, seat.role);
}

// A readable label from a raw seat key and role, e.g. ("depositor:0", "depositor") -> "Depositor 1".
// Used by the transaction log, which carries the key and role rather than a full seat.
export function seatLabelForKey(key: string, seatRole: string): string {
  const role = roleForSeat(seatRole);
  const base = role?.label ?? seatRole;
  const index = Number(key.split(":")[1] ?? 0);
  return seatRole === "depositor" || seatRole === "borrower" ? `${base} ${index + 1}` : base;
}
