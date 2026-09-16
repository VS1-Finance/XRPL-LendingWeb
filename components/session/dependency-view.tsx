"use client";

import type { SessionState, SessionSummary } from "@/lib/types";
import { seatLabelForKey } from "@/lib/roles";
import { shortId } from "@/lib/format";
import { phaseLabel } from "@/lib/phase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// A visual map of the session's on-ledger objects and how they relate: the vault funds the broker, the
// broker originates loans, each loan is owed by a borrower, and (for a permissioned vault) the credential
// issuer gates who may participate. It reads the same polled state the rest of the session view uses, so
// it updates live. Hand-rolled columns (no graph dependency).
export function DependencyView({ state, summary }: { state: SessionState; summary: SessionSummary }) {
  const { vault, broker, loans } = state;
  // Loan.borrower is an address; SessionState.seats has no address, so resolve the borrower's label from
  // the summary's seats (which carry addresses).
  const labelForAddress = (address: string): string => {
    const seat = summary.seats.find((s) => s.address === address);
    return seat ? seatLabelForKey(seat.key, seat.role) : shortId(address, 6, 4);
  };

  const credentialIssuer = summary.seats.find((s) => s.role === "credentialIssuer");

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {summary.permissioned && credentialIssuer && (
          <div className="flex flex-col gap-2">
            <Node title="Credential Issuer" subtitle={shortId(credentialIssuer.address, 8, 6)} tone="violet" />
            <Connector label="credentials — gates who may deposit & borrow" />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Column heading="Vault">
            {vault ? (
              <Node
                title="Vault"
                subtitle={`${vault.assetsTotal} total · ${vault.assetsAvailable} available`}
                tone="sky"
                badge={vault.phase ? <Badge variant="outline" className="text-[10px]">{phaseLabel(vault.phase)}</Badge> : undefined}
              />
            ) : (
              <Empty>No vault</Empty>
            )}
          </Column>

          <Column heading="Broker">
            {broker ? (
              <Node title="Loan Broker" subtitle={`${broker.coverAvailable} first-loss cover`} tone="emerald" />
            ) : (
              <Empty>No broker</Empty>
            )}
          </Column>

          <Column heading="Loans">
            {loans.length === 0 ? (
              <Empty>No loans yet</Empty>
            ) : (
              loans.map((l) => (
                <Node
                  key={l.loanId}
                  title={shortId(l.loanId, 8, 4)}
                  subtitle={`${l.totalOutstanding} outstanding`}
                  tone="amber"
                  badge={
                    l.defaulted ? (
                      <Badge variant="destructive" className="text-[10px]">Defaulted</Badge>
                    ) : l.paymentRemaining > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Repaid</Badge>
                    )
                  }
                />
              ))
            )}
          </Column>

          <Column heading="Borrowers">
            {loans.length === 0 ? (
              <Empty>—</Empty>
            ) : (
              loans.map((l) => (
                <Node key={l.loanId} title={labelForAddress(l.borrower)} subtitle={shortId(l.borrower, 6, 4)} tone="rose" />
              ))
            )}
          </Column>
        </div>

        <p className="text-xs text-muted-foreground">
          Vault funds the broker → broker originates loans → each loan is owed by a borrower.
        </p>
      </CardContent>
    </Card>
  );
}

const TONE: Record<string, string> = {
  sky: "border-sky-500/40",
  emerald: "border-emerald-500/40",
  amber: "border-amber-500/40",
  rose: "border-rose-500/40",
  violet: "border-violet-500/40",
};

function Node({ title, subtitle, tone, badge }: { title: string; subtitle?: string; tone: string; badge?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border-l-4 bg-card p-3 shadow-sm ${TONE[tone] ?? "border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{title}</span>
        {badge}
      </div>
      {subtitle && <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">{subtitle}</p>}
    </div>
  );
}

function Column({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground">↓ {label}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">{children}</div>;
}
