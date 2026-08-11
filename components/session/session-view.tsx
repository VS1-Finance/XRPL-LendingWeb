"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { LogEntry, SessionBalances } from "@/lib/engine-client";
import type { SessionState, SessionSummary } from "@/lib/types";
import { engine } from "@/lib/client";
import { currencyLabel } from "@/lib/format";
import { useParticipant } from "@/lib/identity";
import { ledgerMessage } from "@/lib/ledger-codes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SessionHeader } from "./session-header";
import { StatBand } from "./stat-band";
import { SeatGrid } from "./seat-grid";
import { RolePanel, type ActFn } from "./role-panel";
import { TransactionLog } from "./transaction-log";
import { ActivityChart } from "./activity-chart";
import { ActivityCharts, type HistoryPoint } from "./activity-charts";
import { SessionInfo } from "./session-info";
import { SessionNotFound } from "./session-not-found";
import { WalletPanel } from "./wallet-panel";
import { BrokerBook } from "./broker-book";

// The session orchestrator. It owns the participant identity and every call to the engine client:
// loading the session, polling live state and the transaction log, claiming and releasing seats, and
// dispatching actions. Components below are presentational — they render what this passes and call
// back through it. Binding to the live engine changes nothing here; only the client implementation.
export function SessionView({ setupId }: { setupId: string }) {
  const { participant, ready } = useParticipant();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [balances, setBalances] = useState<SessionBalances | null>(null);
  const [botsRunning, setBotsRunning] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // A bounded in-memory buffer of vault assets and cover sampled on each poll, so the Activity tab can
  // chart how they move "since this page opened" (the engine exposes only the current snapshot).
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  // Pulls the live state and transaction log. Polled on an interval so the view reflects everything
  // happening in the session, including other participants and bots.
  const refresh = useCallback(async () => {
    const [nextState, nextLog, nextBalances] = await Promise.all([
      engine.getState(setupId),
      engine.getLog(setupId),
      engine.getBalances(setupId).catch(() => null),
    ]);
    setState(nextState);
    setLog(nextLog);
    if (nextBalances) setBalances(nextBalances);
    // Append a history point from this poll, skipping any observation that does not parse cleanly, and
    // keep the buffer bounded so a long-lived page cannot grow it without limit.
    const assetsTotal = Number(nextState.vault?.assetsTotal);
    const coverAvailable = Number(nextState.broker?.coverAvailable);
    if (Number.isFinite(assetsTotal) && Number.isFinite(coverAvailable)) {
      setHistory((prev) => {
        const next = [...prev, { ts: Date.now(), assetsTotal, coverAvailable }];
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
    }
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
  // The wallet asset is the vault's true on-ledger currency, carried on the balances payload — not the
  // session summary, whose config the engine does not yet echo (the http client defaults it).
  const asset = balances?.asset ?? "XRP";
  const myBalance = mySeat ? balances?.accounts.find((a) => a.seat === mySeat.key) : undefined;

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

  // Auto-claim: when the goal wizard sends a ?claim=<role>, take the first open seat of that role once
  // the session has loaded — so a goal-driven visitor lands already seated. Runs at most once, and only
  // if the participant does not already hold a seat.
  const searchParams = useSearchParams();
  const autoClaimed = useRef(false);
  useEffect(() => {
    const role = searchParams.get("claim");
    if (!role || autoClaimed.current || !summary || !participant) return;
    if (summary.seats.some((s) => s.occupant.kind === "human" && s.occupant.id === participant)) return;
    const target = summary.seats.find((s) => s.role === role && s.occupant.kind !== "human");
    if (!target) return;
    autoClaimed.current = true;
    void claim(target.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, participant, searchParams]);

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

      <StatBand state={state} mySeat={mySeat} asset={currencyLabel(summary.asset)} />

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
                  balances={balances}
                  asset={asset}
                  vault={state.vault}
                />
              </section>
            </div>

            {/* Right (40%): the action surface for the claimed seat, sticky so it stays in view. */}
            <div className="lg:col-span-2">
              <section className="space-y-3 lg:sticky lg:top-20">
                <SectionLabel>Act</SectionLabel>
                <RolePanel seat={mySeat} state={state} allSeats={seats} onAct={act} loanDefaults={summary.config.loanDefaults} />
                <WalletPanel balance={myBalance} asset={asset} vault={state.vault} />
                {mySeat?.role === "owner" && <BrokerBook state={state} asset={asset} />}
              </section>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6 space-y-6">
          <ActivityChart entries={log} state={state} />
          <ActivityCharts entries={log} state={state} balances={balances} history={history} />
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
