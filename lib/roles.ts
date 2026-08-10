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
  { id: "issuer", label: "Currency Issuer", seatRole: "issuer", description: "Mints and distributes the vault's issued asset. An XRP vault has no currency issuer." },
  { id: "credential-issuer", label: "Credential Issuer", seatRole: "credentialIssuer", description: "Issues and revokes the credentials that grant access. A public vault has no credential issuer." },
  { id: "depositor", label: "Depositor", seatRole: "depositor", description: "Supplies liquidity to the vault and holds yield-bearing shares." },
  { id: "vault-manager", label: "Vault Manager", seatRole: "owner", description: "Configures the vault and the permissioned domain." },
  { id: "loan-originator", label: "Loan Originator", seatRole: "owner", description: "Originates loans against vault liquidity." },
  { id: "borrower", label: "Borrower", seatRole: "borrower", description: "Requests a loan against vault liquidity and repays it over its term." },
];

export function roleForSeat(seatRole: string): UiRoleDef | undefined {
  // Owner seat is shown as vault manager (its two role surfaces share one panel).
  return UI_ROLES.find((r) => r.seatRole === seatRole);
}

// A one-line description of what a seat's role does, shown at the top of its action panel. The owner
// seat performs two roles on one account, so it gets a combined description.
export function roleDescription(seatRole: string): string {
  switch (seatRole) {
    case "issuer":
      return "Mints and distributes the vault's issued asset — a distinct account from the credential issuer, so the raw ledger stays legible. An XRP vault has no currency issuer.";
    case "credentialIssuer":
      return "Grants and revokes the credentials that let accounts into the permissioned vault. Nothing settles for an account you have not credentialed.";
    case "depositor":
      return "Supplies liquidity to the vault and holds yield-bearing shares. Deposits earn a share of the interest borrowers pay.";
    case "owner":
      return "Owns the vault and the loan broker on one account — configuring the vault and permissioned domain, originating loans against vault liquidity, and defaulting delinquent ones.";
    case "borrower":
      return "Draws a loan against vault liquidity and repays it over its term — you can request a loan, which the broker's owner account signs on your behalf. Missing payments lets the loan be defaulted, drawing on first-loss cover.";
    default:
      return "";
  }
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
