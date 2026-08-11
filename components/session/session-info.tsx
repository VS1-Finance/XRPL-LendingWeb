"use client";

import { ExternalLink, Network, User, Coins, Shield, Clock, Bot } from "lucide-react";
import type { SessionState, SessionSummary } from "@/lib/types";
import { accountUrl } from "@/lib/client";
import { seatLabel } from "@/lib/roles";
import { currencyLabel, shortId } from "@/lib/format";
import { LiveState } from "./live-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// The reference view for a session: what it is (id, network, who you are), how it was provisioned
// (config), the account directory, and the detailed positions. None of this is action surface — it
// is the "what am I looking at" context, kept out of the Workspace tab.
export function SessionInfo({
  summary,
  state,
  participant,
}: {
  summary: SessionSummary;
  state: SessionState;
  participant: string;
}) {
  const cfg = summary.config;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <Section title="Session">
          <Card>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 py-5">
              <Field icon={Network} label="Network" value={summary.network} />
              <Field icon={User} label="You" value={participant} mono />
              <Field icon={Coins} label="Vault asset" value={currencyLabel(cfg.asset)} />
              <Field icon={Shield} label="First-loss cover" value={coverDisplay(state)} />
              <Field icon={Clock} label="Payment interval" value={`${cfg.paymentInterval}s`} />
              <Field icon={Bot} label="Bot scenario" value={cfg.scenario} capitalize />
              <Field icon={Bot} label="Bot seed" value={cfg.botSeed ?? "—"} mono />
              <div className="col-span-2">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Session id</div>
                <div className="font-mono text-xs break-all">{summary.setupId}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share this id to let someone join this session.
                </p>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Positions">
          <LiveState state={state} />
        </Section>
      </div>

      <Section title="Accounts">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pl-6 pr-3 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Occupant</th>
                  <th className="px-3 py-2.5 pr-6 text-right font-medium">Address</th>
                </tr>
              </thead>
              <tbody>
                {summary.seats.map((seat) => (
                  <tr key={seat.key} className="border-b align-middle last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 pl-6 pr-3 font-medium">{seatLabel(seat)}</td>
                    <td className="px-3 py-2.5">
                      <OccupantTag seat={seat} me={participant} />
                    </td>
                    <td className="px-3 py-2.5 pr-6 text-right">
                      <a
                        href={accountUrl(seat.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        {shortId(seat.address, 8, 6)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

// First-loss cover comes from the live broker on the validated ledger, not the provisioning config —
// the engine summary doesn't echo the configured cover, and the live figure is the real one. This is
// the same source the header stat band reads, so the two never disagree.
function coverDisplay(state: SessionState): string {
  const cover = state.broker?.coverAvailable;
  if (cover === undefined || cover === null) return "—";
  const n = Number(cover);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(cover);
}

function Field({
  icon: Icon,
  label,
  value,
  mono = false,
  capitalize = false,
}: {
  icon: typeof Network;
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

function OccupantTag({ seat, me }: { seat: SessionSummary["seats"][number]; me: string }) {
  if (seat.occupant.kind === "human") {
    const isMine = seat.occupant.id === me;
    return (
      <Badge variant={isMine ? "default" : "secondary"} className="gap-1">
        <User className="h-3 w-3" /> {isMine ? "You" : seat.occupant.id}
      </Badge>
    );
  }
  if (seat.occupant.kind === "bot") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Bot className="h-3 w-3" /> Bot
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Open
    </Badge>
  );
}
