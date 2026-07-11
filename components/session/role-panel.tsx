"use client";

import { useState } from "react";
import { UserPlus, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { SeatSummary, SessionState } from "@/lib/types";
import type { ActionResult } from "@/lib/engine-client";
import { seatLabel, seatLabelForKey } from "@/lib/roles";
import { txUrl } from "@/lib/client";
import { shortId } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// How the action surface reports back to the caller. Returns the ledger result so the panel can show
// success (with a tx link) or the exact rejection code inline — the enforcement the demo is about.
export type ActFn = (action: string, params?: Record<string, string>) => Promise<ActionResult>;

// The action surface for the seat the participant currently holds. Each role exposes only the actions
// that role owns; the owner seat presents two role surfaces (vault manager and originator) as tabs,
// because on-ledger both are performed by the same account. Live state is passed in so actions that
// target a specific loan or borrower can offer a selector rather than a free-text field.
export function RolePanel({
  seat,
  state,
  onAct,
}: {
  seat: SeatSummary | undefined;
  state: SessionState;
  onAct: ActFn;
}) {
  if (!seat) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted/40">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Take a role to act</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Claim a seat to act as that participant. Its actions will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acting as {seatLabel(seat)}</CardTitle>
        <CardDescription>
          Actions are submitted on-ledger from{" "}
          <span className="font-mono text-xs">{shortId(seat.address)}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {seat.role === "depositor" && <DepositorActions onAct={onAct} />}
        {seat.role === "borrower" && <BorrowerActions seat={seat} state={state} onAct={onAct} />}
        {seat.role === "issuer" && <IssuerActions onAct={onAct} />}
        {seat.role === "owner" && <OwnerActions state={state} onAct={onAct} />}
      </CardContent>
    </Card>
  );
}

// A single submittable action. Holds its own pending/result state and shows the ledger outcome
// directly beneath the control, including a link to the settled transaction or the rejection code.
function ActionRow({
  label,
  placeholder,
  cta,
  action,
  param = "amount",
  onAct,
  variant = "default",
}: {
  label: string;
  placeholder: string;
  cta: string;
  action: string;
  param?: string;
  onAct: ActFn;
  variant?: "default" | "outline";
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit() {
    setPending(true);
    setResult(null);
    const res = await onAct(action, value.trim() ? { [param]: value.trim() } : undefined);
    setResult(res);
    setPending(false);
    if (res.ok) setValue("");
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          className="h-9"
          placeholder={placeholder}
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !pending && submit()}
        />
        <Button variant={variant} className="shrink-0" disabled={pending} onClick={submit}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
        </Button>
      </div>
      <ResultLine result={result} />
    </div>
  );
}

// One option in a selector-backed action.
interface Choice {
  value: string;
  label: string;
}

// An action that targets one of a set of choices (a specific loan, a specific borrower), optionally
// with an amount. The selected choice and the amount are sent as named params. When there are no
// choices, the action is shown disabled with an explanatory line rather than an empty selector.
function SelectActionRow({
  label,
  choices,
  choiceParam,
  choicePlaceholder,
  amountParam,
  amountPlaceholder,
  cta,
  action,
  onAct,
  variant = "default",
  emptyHint,
}: {
  label: string;
  choices: Choice[];
  choiceParam: string;
  choicePlaceholder: string;
  amountParam?: string;
  amountPlaceholder?: string;
  cta: string;
  action: string;
  onAct: ActFn;
  variant?: "default" | "outline";
  emptyHint: string;
}) {
  const [choice, setChoice] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const selected = choice || (choices.length === 1 ? choices[0].value : "");
  const ready = Boolean(selected) && (!amountParam || amount.trim().length > 0);

  async function submit() {
    if (!ready) return;
    setPending(true);
    setResult(null);
    const params: Record<string, string> = { [choiceParam]: selected };
    if (amountParam && amount.trim()) params[amountParam] = amount.trim();
    const res = await onAct(action, params);
    setResult(res);
    setPending(false);
    if (res.ok) setAmount("");
  }

  if (choices.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={setChoice} disabled={pending}>
          <SelectTrigger className="h-9 flex-1">
            <SelectValue placeholder={choicePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {choices.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {amountParam && (
          <Input
            className="h-9 w-28 shrink-0"
            placeholder={amountPlaceholder}
            value={amount}
            disabled={pending}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ready && !pending && submit()}
          />
        )}
        <Button variant={variant} className="shrink-0" disabled={pending || !ready} onClick={submit}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
        </Button>
      </div>
      <ResultLine result={result} />
    </div>
  );
}

// Renders the ledger outcome of the most recent submission: a settled hash link, or the rejection
// code. The rejection is deliberately prominent — surfacing an on-ledger refusal is the point.
function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>Settled · {result.code}</span>
        {result.hash && (
          <a
            href={txUrl(result.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono underline underline-offset-2 hover:text-foreground"
          >
            {shortId(result.hash, 8, 4)}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-destructive">
      <XCircle className="h-3.5 w-3.5 shrink-0" />
      <span>
        Rejected on-ledger · <span className="font-mono font-medium">{result.code}</span>
      </span>
    </div>
  );
}

function DepositorActions({ onAct }: { onAct: ActFn }) {
  return (
    <div className="space-y-4">
      <ActionRow label="Deposit" placeholder="Amount" cta="Deposit" action="deposit" onAct={onAct} />
      <ActionRow label="Withdraw" placeholder="Amount" cta="Withdraw" action="withdraw" variant="outline" onAct={onAct} />
    </div>
  );
}

// A short, readable label for a loan option — its shortened id and outstanding balance.
function loanChoices(loans: SessionState["loans"]): Choice[] {
  return loans.map((l) => ({
    value: l.loanId,
    label: `${shortId(l.loanId, 6, 4)} · ${l.totalOutstanding} out`,
  }));
}

function borrowerChoices(seats: SessionState["seats"]): Choice[] {
  return seats
    .filter((s) => s.key.startsWith("borrower:"))
    .map((s) => ({ value: s.key, label: seatLabelForKey(s.key, "borrower") }));
}

function BorrowerActions({
  seat,
  state,
  onAct,
}: {
  seat: SeatSummary;
  state: SessionState;
  onAct: ActFn;
}) {
  // A borrower repays one of their own outstanding loans. Loans are held under the borrower's account,
  // so only loans for this seat's address are offered.
  const myLoans = state.loans.filter((l) => l.borrower === seat.address && !l.defaulted);
  return (
    <div className="space-y-4">
      <SelectActionRow
        label="Repay a loan"
        choices={loanChoices(myLoans)}
        choiceParam="loanId"
        choicePlaceholder="Select a loan"
        amountParam="amount"
        amountPlaceholder="Amount"
        cta="Repay"
        action="repay"
        onAct={onAct}
        emptyHint="No outstanding loans to repay."
      />
      <p className="text-xs text-muted-foreground">
        Stop repaying to let a loan fall delinquent — the loan originator can then default it, drawing
        on first-loss cover.
      </p>
    </div>
  );
}

function IssuerActions({ onAct }: { onAct: ActFn }) {
  return (
    <div className="space-y-4">
      <ActionRow label="Issue credential" placeholder="Subject address" cta="Issue" action="issue-credential" param="subject" onAct={onAct} />
      <ActionRow label="Revoke credential" placeholder="Subject address" cta="Revoke" action="revoke-credential" param="subject" variant="outline" onAct={onAct} />
    </div>
  );
}

function OwnerActions({ state, onAct }: { state: SessionState; onAct: ActFn }) {
  const activeLoans = state.loans.filter((l) => !l.defaulted && l.paymentRemaining > 0);
  return (
    <Tabs defaultValue="vault">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="vault">Vault Manager</TabsTrigger>
        <TabsTrigger value="originator">Loan Originator</TabsTrigger>
      </TabsList>
      <TabsContent value="vault" className="mt-4 space-y-4">
        <ActionRow label="Set maximum assets" placeholder="Amount" cta="Update" action="set-max-assets" onAct={onAct} />
        <ActionRow label="Accepted credential type" placeholder="e.g. LENDPARTY" cta="Set domain" action="set-domain" param="domain" variant="outline" onAct={onAct} />
      </TabsContent>
      <TabsContent value="originator" className="mt-4 space-y-4">
        <SelectActionRow
          label="Originate a loan"
          choices={borrowerChoices(state.seats)}
          choiceParam="borrower"
          choicePlaceholder="Select a borrower"
          amountParam="amount"
          amountPlaceholder="Principal"
          cta="Originate"
          action="originate"
          onAct={onAct}
          emptyHint="No borrowers in this session."
        />
        <p className="text-xs text-muted-foreground">
          Origination is bilateral — the borrower counter-signs the same transaction.
        </p>
        <SelectActionRow
          label="Default a delinquent loan"
          choices={loanChoices(activeLoans)}
          choiceParam="loanId"
          choicePlaceholder="Select a loan"
          cta="Default"
          action="manage-loan"
          variant="outline"
          onAct={onAct}
          emptyHint="No active loans to default."
        />
      </TabsContent>
    </Tabs>
  );
}
