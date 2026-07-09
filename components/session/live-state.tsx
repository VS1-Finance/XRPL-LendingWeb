import { FileText, Layers } from "lucide-react";
import type { SessionState } from "@/lib/types";
import { shortId } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// The detailed state that the headline stat band does not cover: the vault share token and the
// per-loan breakdown. Headline totals (vault assets, cover, loan count) live in the stat band above.
export function LiveState({ state }: { state: SessionState }) {
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> Vault share token
          </span>
          <span className="font-mono break-all text-muted-foreground">
            {state.vault?.shareMptId ? shortId(state.vault.shareMptId, 10, 8) : "—"}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Loans
          </div>
          {state.loans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No loans yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {state.loans.map((loan) => (
                <div key={loan.loanId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {shortId(loan.loanId, 8, 4)}
                    </span>
                    {loan.defaulted ? (
                      <Badge variant="destructive">Defaulted</Badge>
                    ) : loan.paymentRemaining > 0 ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Repaid</Badge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Outstanding</div>
                      <div className="font-mono">{loan.totalOutstanding}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Payments left</div>
                      <div className="font-mono">{loan.paymentRemaining}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
