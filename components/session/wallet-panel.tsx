import type { AccountBalance } from "@/lib/engine-client";
import type { SessionState } from "@/lib/types";
import { currencyLabel, formatAmount, positionValue, earned } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

// The shared balances body — XRP, the vault asset held (IOU vaults), and the depositor's position —
// used by both the held-seat wallet panel and the per-seat wallet modal. `asset` is the vault's
// on-ledger currency (from the balances payload); a non-standard currency arrives hex-encoded and is
// decoded for the label. When shares are held, the raw share count is translated into a position value
// (the assets those shares are worth) plus unrealized yield; otherwise the raw share count is shown.
export function WalletFigures({ balance, asset, vault }: { balance: AccountBalance; asset: string; vault: SessionState["vault"] }) {
  const isXrp = asset === "XRP";
  const value = vault ? positionValue(balance.shares, vault.sharesTotal ?? "0", vault.assetsTotal) : null;
  // Par basis of the shares held: whole shares at 1.0 per share. Scale is 6 for XRP/MPT, else
  // vault.Scale. Framed as CURRENT unrealized yield (value now vs par), not lifetime P&L.
  const shareScale = vault?.scale && vault.scale > 0 ? vault.scale : 6;
  const wholeSharesHeld = Number(balance.shares) / 10 ** shareScale;
  const parBasis = Number.isFinite(wholeSharesHeld) ? wholeSharesHeld : null;
  const gain = earned(value, parBasis);
  return (
    <div className="space-y-3">
      <Figure label="XRP" value={balance.xrp} />
      {!isXrp && <Figure label={currencyLabel(asset)} value={balance.assetHeld} />}
      {value != null ? (
        <>
          <Figure label={`Position value (${currencyLabel(asset)})`} value={String(value)} />
          {gain != null && <Figure label="Earned (unrealized)" value={String(gain)} />}
        </>
      ) : (
        <Figure label="Vault shares" value={balance.shares} />
      )}
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
export function WalletPanel({ balance, asset, vault }: { balance: AccountBalance | undefined; asset: string; vault: SessionState["vault"] }) {
  if (!balance) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" /> Your wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <WalletFigures balance={balance} asset={asset} vault={vault} />
      </CardContent>
    </Card>
  );
}
