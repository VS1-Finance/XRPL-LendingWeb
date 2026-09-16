// The vault lifecycle phase, mirroring the engine's VaultPhase (packages/shared). "subscription" =
// deposits open, "investment" = lending open, "redemption" = withdrawals open at term.
export type VaultPhase = "subscription" | "investment" | "redemption";

// Which phases each phase-gated action is allowed in — mirrors the engine's ALLOWED_PHASES exactly
// (reference repo packages/engine/src/action-service.ts). Any action not listed here is ungated (repay,
// manage-loan, credential actions, cover deposit, ...). This is the ONLY place the UI's allowed-sets
// live, so the UI gate cannot drift from the ledger; the engine's 409 is still the backstop.
const ALLOWED: Record<string, ReadonlySet<VaultPhase>> = {
  deposit: new Set(["subscription"]),
  originate: new Set(["investment"]),
  "request-loan": new Set(["investment"]),
  withdraw: new Set(["subscription", "redemption"]),
};

// True when `action` may be submitted in `phase`. A null phase (a non-closed-ended vault, or a vault
// whose dates could not be read) gates nothing — today's behavior. An action absent from ALLOWED is
// never gated.
export function phaseAllows(action: string, phase: VaultPhase | null): boolean {
  if (phase === null) return true;
  const allowed = ALLOWED[action];
  return !allowed || allowed.has(phase);
}

export function phaseLabel(phase: VaultPhase): string {
  return { subscription: "Subscription", investment: "Investment", redemption: "Redemption" }[phase];
}

// Format a seconds-remaining figure for a countdown. Under an hour → "m:ss"; an hour or more → a compact
// "Nd Nh" / "Nh Nm". Zero or negative → "0:00" (the boundary is here or just passed). null/undefined →
// an em dash (unknown).
export function formatCountdown(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const s = Math.max(0, Math.floor(seconds));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((s % 3600) / 60);
  return `${hours}h ${mins}m`;
}
