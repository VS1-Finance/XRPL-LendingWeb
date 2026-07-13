// Human-readable meanings for XRP Ledger transaction result codes. The raw code (e.g. "tecNO_AUTH")
// is the on-ledger truth and is always kept alongside — but on its own it means nothing to a reader,
// so each code is given a short message explaining what actually happened. Messages are written for
// this lending context: the codes that arise here are about credentials, liquidity, and loans.

export interface LedgerResult {
  // Whether the ledger accepted the transaction.
  ok: boolean;
  // A short, human-readable explanation of the result.
  message: string;
}

const MESSAGES: Record<string, string> = {
  tesSUCCESS: "Settled on the ledger.",

  // Permissioning — the enforcement this system is built to demonstrate.
  tecNO_AUTH: "Not authorized — the account is not credentialed for this vault.",
  tecNO_PERMISSION: "Not permitted — this account may not perform this action.",
  tecNO_LINE: "No trust line for the asset — the account cannot hold it yet.",
  tecEXPIRED: "Expired — the loan or object is past its valid window (a fully repaid loan is closed and can no longer be paid).",

  // Liquidity and balances.
  tecINSUFFICIENT_FUNDS: "Insufficient funds for this amount.",
  tecINSUFFICIENT_RESERVE: "Insufficient reserve — the account lacks the required XRP reserve.",
  tecUNFUNDED: "Unfunded — not enough balance to cover this transaction.",
  tecUNFUNDED_PAYMENT: "Insufficient balance to make this payment.",
  tecPATH_DRY: "No liquidity available to complete this at the moment.",

  // Loans and objects.
  tecNO_ENTRY: "No matching ledger entry — the loan or object does not exist (or is already closed).",
  tecNO_TARGET: "The target account or object does not exist.",
  tecOBJECT_NOT_FOUND: "The referenced object could not be found on the ledger.",
  tecINSUFFICIENT_PAYMENT: "Payment is below the amount due — pay at least the scheduled installment.",
  tecTOO_SOON: "Too soon — the loan is not yet delinquent. It can only be defaulted after its payment is overdue past the grace period.",
  tecKILLED: "The transaction could not complete and was cancelled.",
  tecINTERNAL: "The ledger hit an internal error processing this — the loan may be in a state that cannot accept this action.",

  // Malformed requests — usually a bad amount or missing field before it reaches the ledger.
  temBAD_AMOUNT: "Invalid amount — enter a positive value.",
  temBAD_CURRENCY: "Invalid currency for this vault.",
  temMALFORMED: "The request was malformed and could not be submitted.",
  temREDUNDANT: "Redundant — this transaction has no effect.",

  // Sequencing and retryable conditions.
  terQUEUED: "Queued — waiting to be included in a ledger.",
  tefPAST_SEQ: "Out of sequence — please retry.",
  tefMAX_LEDGER: "Expired before it could be included — please retry.",
};

// A code is a success only when it is exactly tesSUCCESS; every other class (tec/tem/tef/ter/tel) is a
// failure of some kind, retryable or not.
export function isSuccess(code: string): boolean {
  return code === "tesSUCCESS";
}

// The human-readable result for a code. Unknown codes fall back to a generic message that still keeps
// the reader oriented (and the raw code is shown separately).
export function ledgerResult(code: string): LedgerResult {
  const ok = isSuccess(code);
  const message = MESSAGES[code] ?? (ok ? "Settled on the ledger." : "The ledger rejected this transaction.");
  return { ok, message };
}

// Just the message, for places that only need the text.
export function ledgerMessage(code: string): string {
  return ledgerResult(code).message;
}
