"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { LogEntry, SessionBalances } from "@/lib/engine-client";
import type { SessionState } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Charted reads of what the session has done, over the same data the session already exposes: the
// settled transaction log (with the raw amount carried per row) and the current vault/broker
// snapshot, plus a small in-memory history of state gathered since this page opened. This complements
// the compact ActivityChart summary with time-series and composition views, using recharts.

// Each settled action is bucketed into one of a few event kinds by its label — the same classifier
// ActivityChart uses, redeclared here consistently (do not invent a new one).
type Kind = "deposit" | "withdraw" | "originate" | "repay" | "default";

function kindOf(action: string): Kind | undefined {
  const a = action.toLowerCase();
  if (a.includes("default")) return "default";
  if (a.includes("repay")) return "repay";
  if (a.includes("originate")) return "originate";
  if (a.includes("withdraw")) return "withdraw";
  if (a.includes("deposit") && !a.includes("cover")) return "deposit";
  return undefined;
}

// The semantic hues reused from ActivityChart's legend, as literal colors (the --chart-1..5 tokens are
// greyscale). emerald / amber / sky / violet / rose = the tailwind-600 values.
const HUE = {
  emerald: "#059669",
  amber: "#d97706",
  sky: "#0284c7",
  violet: "#7c3aed",
  rose: "#e11d48",
} as const;

// One point per settled state observation gathered since the page opened.
export interface HistoryPoint {
  ts: number;
  assetsTotal: number;
  coverAvailable: number;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const timeOf = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// A finite number or undefined; guards every Number() parse so NaN never reaches a chart.
function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function ActivityCharts({
  entries,
  state,
  balances,
  history,
}: {
  entries: LogEntry[];
  state: SessionState | null;
  balances: SessionBalances | null;
  history: HistoryPoint[];
}) {
  const asset = balances?.asset ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LoanOutcomesChart entries={entries} />
      <FlowsChart entries={entries} asset={asset} />
      <VaultCompositionChart state={state} asset={asset} />
      <SincePageOpenChart history={history} asset={asset} />
    </div>
  );
}

// A titled card wrapper matching ActivityChart's Card usage.
function ChartCard({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-xs text-muted-foreground">Not enough data yet.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// Chart 1 — Loan outcomes over time: cumulative running counts of originated / repaid / defaulted
// across the settled log, keyed on each settling event's timestamp.
function LoanOutcomesChart({ entries }: { entries: LogEntry[] }) {
  const config = {
    originated: { label: "Originated", color: HUE.sky },
    repaid: { label: "Repaid", color: HUE.violet },
    defaulted: { label: "Defaulted", color: HUE.rose },
  } satisfies ChartConfig;

  const settled = entries
    .filter((e) => e.ok)
    .filter((e) => {
      const k = kindOf(e.action);
      return k === "originate" || k === "repay" || k === "default";
    })
    .slice()
    .sort((a, b) => a.ts - b.ts);

  let originated = 0;
  let repaid = 0;
  let defaulted = 0;
  const data = settled.map((e) => {
    const k = kindOf(e.action);
    if (k === "originate") originated += 1;
    else if (k === "repay") repaid += 1;
    else if (k === "default") defaulted += 1;
    return { ts: e.ts, label: timeOf(e.ts), originated, repaid, defaulted };
  });

  return (
    <ChartCard title="Loan outcomes over time" subtitle="Cumulative originated, repaid, defaulted" empty={data.length === 0}>
      <ChartContainer config={config} className="h-[220px] w-full">
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="originated" type="monotone" stroke="var(--color-originated)" strokeWidth={2} dot={false} />
          <Line dataKey="repaid" type="monotone" stroke="var(--color-repaid)" strokeWidth={2} dot={false} />
          <Line dataKey="defaulted" type="monotone" stroke="var(--color-defaulted)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}

// Chart 2 — Deposits vs withdrawals over time: cumulative area. Uses the raw per-row amount when the
// engine carries one; otherwise falls back to counting each settled event as one unit.
function FlowsChart({ entries, asset }: { entries: LogEntry[]; asset: string }) {
  const config = {
    deposited: { label: "Deposited", color: HUE.emerald },
    withdrawn: { label: "Withdrawn", color: HUE.amber },
  } satisfies ChartConfig;

  const flows = entries
    .filter((e) => e.ok)
    .filter((e) => {
      const k = kindOf(e.action);
      return k === "deposit" || k === "withdraw";
    })
    .slice()
    .sort((a, b) => a.ts - b.ts);

  // If no row carries an amount, fall back to counts so the chart still reads.
  const anyAmount = flows.some((e) => num(e.amount) !== undefined);

  let deposited = 0;
  let withdrawn = 0;
  const data = flows.map((e) => {
    const k = kindOf(e.action);
    const magnitude = anyAmount ? num(e.amount) ?? 0 : 1;
    if (k === "deposit") deposited += magnitude;
    else if (k === "withdraw") withdrawn += magnitude;
    return { ts: e.ts, label: timeOf(e.ts), deposited, withdrawn };
  });

  const subtitle = anyAmount
    ? `Cumulative ${asset || "asset"} deposited and withdrawn`
    : "Cumulative deposit and withdrawal counts";

  return (
    <ChartCard title="Deposits vs withdrawals over time" subtitle={subtitle} empty={data.length === 0}>
      <ChartContainer config={config} className="h-[220px] w-full">
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <defs>
            <linearGradient id="fillDeposited" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-deposited)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-deposited)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="fillWithdrawn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-withdrawn)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-withdrawn)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area dataKey="deposited" type="monotone" stroke="var(--color-deposited)" fill="url(#fillDeposited)" strokeWidth={2} />
          <Area dataKey="withdrawn" type="monotone" stroke="var(--color-withdrawn)" fill="url(#fillWithdrawn)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

// Chart 3 — Vault composition snapshot: from current state, how the pool splits between lent-out and
// available liquidity, alongside the broker's first-loss cover. A horizontal bar of the three amounts.
function VaultCompositionChart({ state, asset }: { state: SessionState | null; asset: string }) {
  const assetsTotal = num(state?.vault?.assetsTotal) ?? 0;
  const assetsAvailable = num(state?.vault?.assetsAvailable) ?? 0;
  const cover = num(state?.broker?.coverAvailable) ?? 0;
  const lent = Math.max(0, assetsTotal - assetsAvailable);

  const config = {
    amount: { label: asset || "Amount" },
    lent: { label: "Lent out", color: HUE.sky },
    available: { label: "Available", color: HUE.emerald },
    cover: { label: "First-loss cover", color: HUE.violet },
  } satisfies ChartConfig;

  const data = [
    { key: "lent", label: "Lent out", amount: lent, fill: HUE.sky },
    { key: "available", label: "Available", amount: assetsAvailable, fill: HUE.emerald },
    { key: "cover", label: "First-loss cover", amount: cover, fill: HUE.violet },
  ];

  const empty = lent + assetsAvailable + cover <= 0;

  return (
    <ChartCard title="Vault composition" subtitle={`Lent vs available liquidity, plus first-loss cover${asset ? ` (${asset})` : ""}`} empty={empty}>
      <ChartContainer config={config} className="h-[220px] w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={110} />
          <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
          <Bar dataKey="amount" radius={4} />
        </BarChart>
      </ChartContainer>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Legend color={HUE.sky} label="Lent out" value={fmt(lent)} />
        <Legend color={HUE.emerald} label="Available" value={fmt(assetsAvailable)} />
        <Legend color={HUE.violet} label="Cover" value={fmt(cover)} />
      </div>
    </ChartCard>
  );
}

// Chart 4 — Assets & cover since this page opened: a live line over the history buffer that
// session-view accumulates on each poll. Explicitly scoped to the current page session so it is not
// read as full history.
function SincePageOpenChart({ history, asset }: { history: HistoryPoint[]; asset: string }) {
  const config = {
    assetsTotal: { label: "Vault assets", color: HUE.sky },
    coverAvailable: { label: "First-loss cover", color: HUE.violet },
  } satisfies ChartConfig;

  const data = history
    .map((p) => {
      const assetsTotal = num(p.assetsTotal);
      const coverAvailable = num(p.coverAvailable);
      if (assetsTotal === undefined || coverAvailable === undefined) return null;
      return { ts: p.ts, label: timeOf(p.ts), assetsTotal, coverAvailable };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <ChartCard
      title="Assets & cover since this page opened"
      subtitle={`Live${asset ? ` ${asset}` : ""} totals sampled each poll since this page opened`}
      empty={data.length < 2}
    >
      <ChartContainer config={config} className="h-[220px] w-full">
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="assetsTotal" type="monotone" stroke="var(--color-assetsTotal)" strokeWidth={2} dot={false} />
          <Line dataKey="coverAvailable" type="monotone" stroke="var(--color-coverAvailable)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono tabular-nums">{value}</span>
    </div>
  );
}
