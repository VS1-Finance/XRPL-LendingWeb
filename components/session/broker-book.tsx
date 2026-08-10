"use client";

import { Landmark } from "lucide-react";
import type { SessionState } from "@/lib/types";
import { currencyLabel } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The Vault Manager's broker book: a compact P&L derived from the live broker and vault objects.
// Owner-only — gated at the call site. Every figure guards a missing field so it degrades to "—",
// because a public vault has a broker but may lack rate fields, a healthy vault has no LossUnrealized,
// and a fresh vault has no shares yet.
export function BrokerBook({ state, asset }: { state: SessionState; asset: string }) {
  const broker = state.broker;
  const vault = state.vault;
  const label = currencyLabel(asset);

  // Earned yield proxy: assets grown above the par of the shares in issue. sharesTotal is raw base
  // units (scale 6 for XRP/MPT, else vault.scale); par value = whole shares at 1.0. assetsTotal is
  // whole-token. When no shares exist yet the yield is undefined, so we show "—" rather than 0.
  const shareScale = vault?.scale && vault.scale > 0 ? vault.scale : 6;
  const wholeShares = vault ? Number(vault.sharesTotal ?? "0") / 10 ** shareScale : 0;
  const assets = Number(vault?.assetsTotal ?? "0");
  const earnedYield = vault && Number.isFinite(wholeShares) && wholeShares > 0 ? assets - wholeShares : null;

  const lossAbsorbed = vault?.lossUnrealized != null ? Number(vault.lossUnrealized) : null;
  const debt = broker?.debtTotal != null ? Number(broker.debtTotal) : null;
  const cover = broker?.coverAvailable != null ? Number(broker.coverAvailable) : null;
  // Management fee rate is a 1/10-bps integer: 1000 = 1%. Divide by 1000 for a percent figure.
  const feePct = broker?.managementFeeRate ? broker.managementFeeRate / 1000 : null;
  // Net = earned yield minus losses absorbed by the vault (the manager's one headline figure).
  const net = earnedYield != null && lossAbsorbed != null ? earnedYield - lossAbsorbed : earnedYield;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-muted-foreground" /> Broker book
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label={`Earned yield (${label})`} value={fmt(earnedYield)} />
        <Row label={`Defaults absorbed (${label})`} value={fmt(lossAbsorbed)} />
        <Row label={`Cover available (${label})`} value={fmt(cover)} />
        <Row label={`Debt outstanding (${label})`} value={fmt(debt)} />
        <Row label="Management fee" value={feePct != null ? `${feePct.toLocaleString(undefined, { maximumFractionDigits: 3 })}%` : "—"} />
        <Row label={`Net (${label})`} value={fmt(net)} bold />
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

function fmt(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
