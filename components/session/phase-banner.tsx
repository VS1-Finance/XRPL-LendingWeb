"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SessionState } from "@/lib/types";
import { phaseLabel, formatCountdown, type VaultPhase } from "@/lib/phase";

// Per-phase copy: the phase label, the action it opens, and (for the two non-terminal phases) what the
// countdown is counting down to.
const COPY: Record<VaultPhase, { open: string; nextLabel: string | null }> = {
  subscription: { open: "deposits open", nextLabel: "lending in" },
  investment: { open: "lending open", nextLabel: "redemption in" },
  redemption: { open: "withdrawals open", nextLabel: null },
};

const VARIANT: Record<VaultPhase, "brand" | "secondary" | "outline"> = {
  subscription: "brand",
  investment: "secondary",
  redemption: "outline",
};

// A standalone banner above the stat strip. Phase governs what every role can do, so it gets top
// billing. The countdown ticks locally each second and re-syncs to the engine's secondsUntilNextPhase
// on every poll (the parent re-renders this component with fresh state every 2.5s).
export function PhaseBanner({ state }: { state: SessionState }) {
  const phase = state.vault?.phase ?? null;
  const engineSeconds = state.vault?.secondsUntilNextPhase ?? null;

  // Local countdown seeded from the engine value; ticks down each second between polls. Re-seeds
  // whenever the engine value changes (a poll landed), so it never drifts far from the source of truth.
  const [seconds, setSeconds] = useState<number | null>(engineSeconds);
  useEffect(() => setSeconds(engineSeconds), [engineSeconds]);
  useEffect(() => {
    if (seconds === null) return;
    const t = setInterval(() => setSeconds((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(t);
  }, [seconds === null]);

  if (!phase) return null; // non-closed-ended / unknown — no lifecycle to show

  const copy = COPY[phase];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <Badge variant={VARIANT[phase]} size="default">
        {phaseLabel(phase)}
      </Badge>
      <span className="text-sm text-muted-foreground">{copy.open}</span>
      {copy.nextLabel && (
        <span className="ml-auto font-mono text-sm">
          {copy.nextLabel} {formatCountdown(seconds)}
        </span>
      )}
    </div>
  );
}
