// Formatting for transaction-log entries, shared by the mock and the HTTP client so both render the
// log the same way. The engine stores raw action names and params; the display label and the
// human-readable detail are produced here.

const ACTION_LABEL: Record<string, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  "issue-credential": "Issue credential",
  "revoke-credential": "Revoke credential",
  "set-max-assets": "Set maximum assets",
  "set-vault": "Set maximum assets",
  "set-domain": "Set accepted credential",
  originate: "Originate loan",
  repay: "Repay loan",
  "manage-loan": "Default loan",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

// A short, human-readable detail for a log row, derived from the raw params. Handles both the UI's
// param names (amount, domain) and the engine's (principal, assetsMaximum, credentialType).
export function actionDetail(params: Record<string, string> | undefined, asset = "RLUSD"): string | undefined {
  if (!params) return undefined;
  const amount = params.amount ?? params.principal ?? params.assetsMaximum;
  if (amount && Number(amount) > 0) return `${Number(amount).toLocaleString()} ${asset}`;
  if (params.subject) return short(params.subject);
  if (params.borrower) return params.borrower;
  if (params.loanId) return short(params.loanId);
  if (params.domain ?? params.credentialType) return params.domain ?? params.credentialType;
  return undefined;
}

function short(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
