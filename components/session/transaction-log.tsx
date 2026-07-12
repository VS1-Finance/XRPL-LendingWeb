"use client";

import { ExternalLink, User, Bot, Settings } from "lucide-react";
import type { LogEntry } from "@/lib/engine-client";
import { txUrl } from "@/lib/client";
import { seatLabelForKey } from "@/lib/roles";
import { ledgerMessage } from "@/lib/ledger-codes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// The append-only record of everything that happened in the session — every action from the initial
// setup, the bots, and each human — with its actor, ledger result, and a link to the transaction on
// the Devnet explorer. This is the session's audit surface.
export function TransactionLog({ entries }: { entries: LogEntry[] }) {
  const ordered = [...entries].sort((a, b) => b.seq - a.seq);

  return (
    <Card>
      <CardContent className="p-0">
        {ordered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-12 py-2.5 pl-6 pr-3 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Actor</th>
                  <th className="px-3 py-2.5 font-medium">By</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Result</th>
                  <th className="px-3 py-2.5 pr-6 text-right font-medium">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((e) => (
                  <tr key={e.seq} className="border-b align-middle last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 pl-6 pr-3 font-mono text-xs text-muted-foreground tabular-nums">
                      {e.seq}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{seatLabelForKey(e.actor, e.role)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ByIcon by={e.by} />
                        {e.by}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span>{e.action}</span>
                      {e.detail && <span className="ml-1.5 text-muted-foreground">· {e.detail}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={e.ok ? "secondary" : "destructive"}
                        className="font-mono text-[11px] font-normal"
                        title={ledgerMessage(e.code)}
                      >
                        {e.code}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 pr-6 text-right">
                      {e.hash ? (
                        <a
                          href={txUrl(e.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          {e.hash.slice(0, 12)}…{e.hash.slice(-6)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ByIcon({ by }: { by: LogEntry["by"] }) {
  const cls = "h-3.5 w-3.5 text-muted-foreground shrink-0";
  if (by === "human") return <User className={cls} />;
  if (by === "bot") return <Bot className={cls} />;
  return <Settings className={cls} />;
}
