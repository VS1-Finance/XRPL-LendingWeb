import type { AccountBalance } from "@/lib/engine-client";
import { currencyLabel, formatAmount } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

// The shared balances body — XRP, the vault asset held (IOU vaults), and vault shares — used by both the
// held-seat wallet panel and the per-seat wallet modal. `asset` is the vault's on-ledger currency (from
// the balances payload); a non-standard currency arrives hex-encoded and is decoded for the label.
export function WalletFigures({ balance, asset }: { balance: AccountBalance; asset: string }) {
  const isXrp = asset === "XRP";
  return (
    <div className="space-y-3">
      <Figure label="XRP" value={balance.xrp} />
      {!isXrp && <Figure label={currencyLabel(asset)} value={balance.assetHeld} />}
      <Figure label="Vault shares" value={balance.shares} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{formatAmount(value)}</span>
    </div>
  );
}

// The wallet card for the seat the participant currently holds, shown below the action panel. Renders
// nothing when no seat is held.
export function WalletPanel({ balance, asset }: { balance: AccountBalance | undefined; asset: string }) {
  if (!balance) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" /> Your wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <WalletFigures balance={balance} asset={asset} />
      </CardContent>
    </Card>
  );
}
