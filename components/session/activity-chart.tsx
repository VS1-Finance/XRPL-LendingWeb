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
  const settled = entries.filter((e) => e.ok);
  const counts = new Map<Kind, number>();
  // The cumulative count of deposit-vs-loan events over the log sequence — a cheap proxy for how the
  // market filled and lent over time.
  const series: number[] = [];
  let running = 0;
  for (const e of [...settled].sort((a, b) => a.seq - b.seq)) {
    const k = kindOf(e.action);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    running += k === "withdraw" || k === "default" ? -1 : 1;
    series.push(running);
  }

  const total = KINDS.reduce((sum, { kind }) => sum + (counts.get(kind) ?? 0), 0);
  const activeLoans = state?.loans.filter((l) => !l.defaulted && l.paymentRemaining > 0).length ?? 0;
  const defaultedLoans = state?.loans.filter((l) => l.defaulted).length ?? 0;

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

        {/* Cumulative net-activity sparkline. */}
        <Sparkline series={series} />

        {/* Event composition — a count per kind. */}
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

// A minimal inline-SVG line of the cumulative series, normalized to the box. Flat when there is nothing
// to show. No axes — it is a shape, not a precise chart.
function Sparkline({ series }: { series: number[] }) {
  const w = 600;
  const h = 64;
  if (series.length < 2) {
    return <div className="h-16 rounded-md border bg-muted/20" />;
  }
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = max - min || 1;
  const step = w / (series.length - 1);
  const points = series
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * (h - 8) - 4).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full rounded-md border bg-muted/20">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-foreground/70" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
