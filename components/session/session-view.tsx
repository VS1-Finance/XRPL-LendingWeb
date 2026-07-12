"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { LogEntry } from "@/lib/engine-client";
import type { SessionState, SessionSummary } from "@/lib/types";
import { engine } from "@/lib/client";
import { useParticipant } from "@/lib/identity";
import { ledgerMessage } from "@/lib/ledger-codes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SessionHeader } from "./session-header";
import { StatBand } from "./stat-band";
import { SeatGrid } from "./seat-grid";
import { RolePanel, type ActFn } from "./role-panel";
import { TransactionLog } from "./transaction-log";
import { SessionInfo } from "./session-info";
import { SessionNotFound } from "./session-not-found";

// The session orchestrator. It owns the participant identity and every call to the engine client:
// loading the session, polling live state and the transaction log, claiming and releasing seats, and
// dispatching actions. Components below are presentational — they render what this passes and call
// back through it. Binding to the live engine changes nothing here; only the client implementation.
export function SessionView({ setupId }: { setupId: string }) {
  const { participant, ready } = useParticipant();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [botsRunning, setBotsRunning] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Pulls the live state and transaction log. Polled on an interval so the view reflects everything
  // happening in the session, including other participants and bots.
  const refresh = useCallback(async () => {
    const [nextState, nextLog] = await Promise.all([engine.getState(setupId), engine.getLog(setupId)]);
    setState(nextState);
    setLog(nextLog);
  }, [setupId]);

  // Initial load of the seat graph, then start polling. A session id that does not resolve (a bad or
  // shared-but-gone id, or a Devnet reset) drops the view to a not-found state instead of hanging.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const s = await engine.getSession(setupId);
        if (!active) return;
        setSummary(s);
        await refresh();
        timer = setInterval(refresh, 2500);
      } catch {
        if (active) setNotFound(true);
      }
    })();
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [setupId, refresh]);

  const seats = summary?.seats ?? [];
  const mySeat = seats.find((s) => s.occupant.kind === "human" && s.occupant.id === participant);

  async function claim(seatKey: string) {
    if (!participant) return;
    const next = await engine.claimSeat(setupId, seatKey, participant);
    setSummary(next);
    toast.success("Seat claimed", { description: "You are now acting as this role." });
  }

  async function release(seatKey: string) {
    if (!participant) return;
    const next = await engine.releaseSeat(setupId, seatKey, participant);
    setSummary(next);
    toast("Seat released");
  }

  async function addParticipant(role: "depositor" | "borrower") {
    const next = await engine.addParticipant(setupId, role);
    setSummary(next);
    await refresh();
    toast.success(`${role === "depositor" ? "Depositor" : "Borrower"} added`, {
      description: "A new credentialed bot participant joined the pool.",
    });
  }

  // Dispatches an action from the participant's seat and reports the ledger result back to the panel,
  // then refreshes so live state and the log reflect it. Rejections are returned, not thrown — the
  // panel surfaces the exact result code.
  const act: ActFn = async (action, params) => {
    if (!mySeat || !participant) return { code: "temMALFORMED", ok: false };
    const result = await engine.act(setupId, participant, { seat: mySeat.key, action, params });
    await refresh();
    if (result.ok) {
      toast.success("Settled on-ledger", { description: ledgerMessage(result.code) });
    } else {
      toast.error("Rejected on-ledger", { description: `${ledgerMessage(result.code)} (${result.code})` });
    }
    return result;
  };

  async function toggleBots() {
    if (botsRunning) {
      await engine.stopBots(setupId);
      setBotsRunning(false);
      toast("Bots stopped", { description: "The pool is paused." });
    } else {
      await engine.startBots(setupId);
      setBotsRunning(true);
      toast("Bots started", { description: "The pool is driving every unheld seat." });
    }
    setSummary(await engine.getSession(setupId));
  }

  if (notFound) {
    return <SessionNotFound setupId={setupId} />;
  }

  if (!ready || !summary || !state) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading session…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SessionHeader
        setupId={setupId}
        network={summary.network}
        participant={participant ?? "…"}
        botsRunning={botsRunning}
        onToggleBots={toggleBots}
      />

      <StatBand state={state} mySeat={mySeat} />

      {/* The stat band above stays visible for both views; the tabs switch the working area. The
          activity log gets its own full-width tab so its wide table is never cramped. */}
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            Activity
            {log.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {log.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-6">
          <div className="grid items-start gap-8 lg:grid-cols-5">
            {/* Left (60%): the seats to claim. */}
            <div className="lg:col-span-3">
              <section className="space-y-3">
                <SectionLabel>Roles</SectionLabel>
                <SeatGrid
                  seats={seats}
                  me={participant ?? ""}
                  onClaim={claim}
                  onRelease={release}
                  onAddParticipant={addParticipant}
                />
              </section>
            </div>

            {/* Right (40%): the action surface for the claimed seat, sticky so it stays in view. */}
            <div className="lg:col-span-2">
              <section className="space-y-3 lg:sticky lg:top-20">
                <SectionLabel>Act</SectionLabel>
                <RolePanel seat={mySeat} state={state} allSeats={seats} onAct={act} />
              </section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <TransactionLog entries={log} />
        </TabsContent>

        <TabsContent value="info" className="mt-6">
          <SessionInfo summary={summary} state={state} participant={participant ?? "…"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
  );
}
