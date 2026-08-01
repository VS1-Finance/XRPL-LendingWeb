"use client";

import { Vault, Shield, FileText, UserCircle2 } from "lucide-react";
import type { SessionState, SeatSummary } from "@/lib/types";
import { seatLabel } from "@/lib/roles";
import { Card } from "@/components/ui/card";

// The headline summary of the session: the numbers a participant checks at a glance before acting.
// Detailed breakdowns (available liquidity, per-loan status) live in the Live state panel below.
export function StatBand({
  state,
  mySeat,
  asset = "XRP",
}: {
  state: SessionState;
  mySeat: SeatSummary | undefined;
  asset?: string;
}) {
  const activeLoans = state.loans.filter((l) => !l.defaulted && l.paymentRemaining > 0).length;
  const defaulted = state.loans.filter((l) => l.defaulted).length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat
        icon={Vault}
        label="Vault assets"
        value={fmt(state.vault?.assetsTotal)}
        unit={asset}
        sub={`${fmt(state.vault?.assetsAvailable)} available`}
      />
      <Stat
        icon={Shield}
        label="First-loss cover"
        value={fmt(state.broker?.coverAvailable)}
        unit={asset}
        sub="broker capital"
      />
      <Stat
        icon={FileText}
        label="Loans"
        value={String(activeLoans)}
        sub={defaulted ? `${defaulted} defaulted` : "active"}
      />
      <Stat
        icon={UserCircle2}
        label="Your role"
        value={mySeat ? seatLabel(mySeat) : "—"}
        sub={mySeat ? "acting" : "spectating"}
        valueClass={mySeat ? "" : "text-muted-foreground"}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  valueClass = "",
}: {
  icon: typeof Vault;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${valueClass}`}>
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function fmt(value: string | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
