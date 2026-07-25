"use client";

import { Wallet, ExternalLink } from "lucide-react";
import type { SessionBalances } from "@/lib/engine-client";
import { accountUrl } from "@/lib/client";
import { shortId } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { WalletFigures } from "./wallet-panel";

// A wallet-icon button on a seat that opens that seat's live balances. It reads from the session's
// polled balances payload, so while open it reflects the latest poll — a deposit settling elsewhere
// updates it within a cycle.
export function WalletModal({ seatKey, label, balances, asset }: { seatKey: string; label: string; balances: SessionBalances | null; asset: string }) {
  const balance = balances?.accounts.find((a) => a.seat === seatKey);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label={`${label} wallet`}>
          <Wallet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} · wallet</DialogTitle>
        </DialogHeader>
        {balance ? (
          <div className="space-y-4">
            <a
              href={accountUrl(balance.address)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              {shortId(balance.address)} <ExternalLink className="h-3 w-3" />
            </a>
            <WalletFigures balance={balance} asset={asset} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No balance data yet.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
