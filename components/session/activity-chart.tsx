"use client";

import { ArrowDownToLine, ArrowUpFromLine, FileSignature, HandCoins, ShieldX } from "lucide-react";
import type { LogEntry } from "@/lib/engine-client";
import type { SessionState } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// A visual read of what has happened in the session, over data the session already exposes: the
// transaction log (settled actions) and the current vault/broker snapshot. It answers "what is this
// market doing?" at a glance — the composition of activity and how deposits accumulated over time —
// without a charting dependency (small inline SVG).

// Each settled action is bucketed into one of a few event kinds by its label.
type Kind = "deposit" | "withdraw" | "originate" | "repay" | "default";

const KINDS: { kind: Kind; label: string; icon: typeof ArrowDownToLine; className: string }[] = [
  { kind: "deposit", label: "Deposits", icon: ArrowDownToLine, className: "text-emerald-600 dark:text-emerald-500" },
  { kind: "withdraw", label: "Withdrawals", icon: ArrowUpFromLine, className: "text-amber-600 dark:text-amber-500" },
  { kind: "originate", label: "Originations", icon: FileSignature, className: "text-sky-600 dark:text-sky-500" },
  { kind: "repay", label: "Repayments", icon: HandCoins, className: "text-violet-600 dark:text-violet-500" },
  { kind: "default", label: "Defaults", icon: ShieldX, className: "text-rose-600 dark:text-rose-500" },
];

function kindOf(action: string): Kind | undefined {
  const a = action.toLowerCase();
  if (a.includes("default")) return "default";
  if (a.includes("repay")) return "repay";
  if (a.includes("originate")) return "originate";
  if (a.includes("withdraw")) return "withdraw";
  if (a.includes("deposit") && !a.includes("cover")) return "deposit";
  return undefined;
}

export function ActivityChart({ entries, state }: { entries: LogEntry[]; state: SessionState | null }) {
  // Count market activity only — a human or bot participant acting. Provisioning steps (by: "system")
  // set up the environment (e.g. seeding vault liquidity) and are not participant deposits, so counting
  // them would show "Deposits N" before any depositor has acted.
  const settled = entries.filter((e) => e.ok && e.by !== "system");
  const counts = new Map<Kind, number>();
  for (const e of settled) {
    const k = kindOf(e.action);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const total = KINDS.reduce((sum, { kind }) => sum + (counts.get(kind) ?? 0), 0);
  const activeLoans = state?.loans.filter((l) => !l.defaulted && l.paymentRemaining > 0).length ?? 0;
  const defaultedLoans = state?.loans.filter((l) => l.defaulted).length ?? 0;

  // Vault utilization: how much of the pool is lent out vs. sitting available. assetsTotal is all
  // deposited liquidity; assetsAvailable is what is not currently backing a loan.
  const assetsTotal = Number(state?.vault?.assetsTotal ?? "0");
  const assetsAvailable = Number(state?.vault?.assetsAvailable ?? "0");
  const lent = Math.max(0, assetsTotal - assetsAvailable);
  const lentPct = assetsTotal > 0 ? Math.min(100, (lent / assetsTotal) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Vault assets" value={state?.vault?.assetsTotal ?? "0"} />
          <Stat label="First-loss cover" value={state?.broker?.coverAvailable ?? "0"} />
          <Stat label="Active loans" value={String(activeLoans)} />
          <Stat label="Defaulted" value={String(defaultedLoans)} />
        </div>

        {/* How deployed the pool is: lent out vs. available. */}
        <UtilizationBar total={assetsTotal} lent={lent} available={assetsAvailable} lentPct={lentPct} />

        {/* Event composition — how many of each action have SETTLED, not amounts. Headed explicitly so
            a count (e.g. "Deposits 8") reads as eight settled deposit transactions, not a balance —
            balances live in the stat band and utilization bar above. */}
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Settled actions</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {KINDS.map(({ kind, label, icon: Icon, className }) => {
            const n = counts.get(kind) ?? 0;
            return (
              <div key={kind} className="flex items-center gap-2 text-sm">
                <Icon className={`h-4 w-4 shrink-0 ${className}`} />
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-auto font-mono tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
        {total === 0 && <p className="text-xs text-muted-foreground">No settled market activity yet.</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

// Vault utilization at a glance: the share of deposited liquidity currently lent out. A filled bar and
// a legend, so it reads with any amount of data — an empty vault shows an empty bar, not a flat line.
function UtilizationBar({ total, lent, available, lentPct }: { total: number; lent: number; available: number; lentPct: number }) {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">Vault utilization</span>
        <span className="font-mono tabular-nums text-muted-foreground">
          {total > 0 ? `${lentPct.toFixed(0)}% lent` : "no deposits yet"}
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full border bg-muted/30">
        <div className="h-full bg-sky-500/80" style={{ width: `${lentPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500/80" /> Lent out{" "}
          <span className="font-mono tabular-nums text-foreground">{fmt(lent)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border bg-muted/30" /> Available{" "}
          <span className="font-mono tabular-nums text-foreground">{fmt(available)}</span>
        </span>
      </div>
    </div>
  );
}
