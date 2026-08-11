"use client";

import { useState } from "react";
import { UserPlus, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { SeatSummary, SessionConfig, SessionState } from "@/lib/types";
import type { ActionResult } from "@/lib/engine-client";
import { seatLabel, seatLabelForKey, roleDescription } from "@/lib/roles";
import { txUrl } from "@/lib/client";
import { shortId } from "@/lib/format";
import { ledgerMessage } from "@/lib/ledger-codes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  allSeats,
  onAct,
  loanDefaults,
}: {
  seat: SeatSummary | undefined;
  state: SessionState;
  allSeats: SeatSummary[];
  onAct: ActFn;
  // Session-level default loan terms, so the originator sees the inherited values pre-filled. Optional:
  // a session created without defaults, or a mock/older engine, omits it.
  loanDefaults?: SessionConfig["loanDefaults"];
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
      <CardContent className="space-y-4">
        {/* What this role does — shown above its actions so a first-time participant has context. */}
        <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {roleDescription(seat.role)}
        </p>
        {seat.role === "depositor" && <DepositorActions credentialPending={isCredentialPending(seat, state)} onAct={onAct} />}
        {seat.role === "borrower" && <BorrowerActions seat={seat} state={state} credentialPending={isCredentialPending(seat, state)} onAct={onAct} />}
        {seat.role === "credentialIssuer" && <CredentialIssuerActions allSeats={allSeats} onAct={onAct} />}
        {seat.role === "issuer" && <CurrencyIssuerActions />}
        {seat.role === "owner" && <OwnerActions state={state} onAct={onAct} loanDefaults={loanDefaults} />}
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

// A single-button action with no input — the action carries all it needs (e.g. accepting a
// credential, where the issuer and type are implied by the session).
function PlainAction({
  label,
  hint,
  cta,
  action,
  onAct,
  variant = "outline",
}: {
  label: string;
  hint?: string;
  cta: string;
  action: string;
  onAct: ActFn;
  variant?: "default" | "outline";
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit() {
    setPending(true);
    setResult(null);
    setResult(await onAct(action));
    setPending(false);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Button variant={variant} className="w-full" disabled={pending} onClick={submit}>
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {cta}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
  amountByChoice,
  amountHint,
  secondaryParam,
  secondaryLabel,
  secondaryPlaceholder,
  secondaryDefault,
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
  // When set, selecting a choice prefills the amount with its value (e.g. a loan's outstanding
  // balance), so the user pays the right amount instead of guessing.
  amountByChoice?: Record<string, string>;
  amountHint?: (value: string) => string | undefined;
  // An optional secondary field sent alongside the choice and amount (e.g. a loan's payment interval).
  secondaryParam?: string;
  secondaryLabel?: string;
  secondaryPlaceholder?: string;
  secondaryDefault?: string;
  cta: string;
  action: string;
  onAct: ActFn;
  variant?: "default" | "outline";
  emptyHint: string;
}) {
  const [choice, setChoice] = useState("");
  const [amount, setAmount] = useState("");
  const [secondary, setSecondary] = useState(secondaryDefault ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const selected = choice || (choices.length === 1 ? choices[0].value : "");
  const ready = Boolean(selected) && (!amountParam || amount.trim().length > 0);

  // Prefill the amount from the selected choice, so e.g. repaying a loan defaults to what is owed.
  function pick(value: string) {
    setChoice(value);
    setResult(null);
    if (amountByChoice && amountByChoice[value] !== undefined) setAmount(amountByChoice[value]);
  }

  async function submit() {
    if (!ready) return;
    setPending(true);
    setResult(null);
    const params: Record<string, string> = { [choiceParam]: selected };
    if (amountParam && amount.trim()) params[amountParam] = amount.trim();
    if (secondaryParam && secondary.trim()) params[secondaryParam] = secondary.trim();
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

  // The selector (which can carry a long label, e.g. a loan id) always gets its own full-width row so
  // it never squeezes the amount field or the submit button off the edge of a narrow panel. When there
  // is an amount, it sits with the button on a second row; otherwise the button follows directly.
  const submitButton = (
    <Button variant={variant} className="shrink-0" disabled={pending || !ready} onClick={submit}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
    </Button>
  );

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={selected} onValueChange={pick} disabled={pending}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder={choicePlaceholder} className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {amountParam ? (
        <div className="flex items-center gap-2">
          <Input
            className="h-9 flex-1"
            placeholder={amountPlaceholder}
            value={amount}
            disabled={pending}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ready && !pending && submit()}
          />
          {submitButton}
        </div>
      ) : (
        <Button variant={variant} className="w-full" disabled={pending || !ready} onClick={submit}>
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {cta}
        </Button>
      )}
      {secondaryParam && (
        <div className="flex items-center gap-2">
          {secondaryLabel && (
            <span className="shrink-0 text-xs text-muted-foreground">{secondaryLabel}</span>
          )}
          <Input
            className="h-8 flex-1"
            type="number"
            placeholder={secondaryPlaceholder}
            value={secondary}
            disabled={pending}
            onChange={(e) => setSecondary(e.target.value)}
          />
        </div>
      )}
      {amountHint && selected && amountHint(selected) && (
        <p className="text-xs text-muted-foreground">{amountHint(selected)}</p>
      )}
      <ResultLine result={result} />
    </div>
  );
}

// Renders the ledger outcome of the most recent submission: a settled hash link, or the rejection
// with a human-readable reason. The raw result code is kept as a small tag — it is the on-ledger
// truth — but the plain-language message is what the reader sees first.
function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{ledgerMessage(result.code)}</span>
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
    <div className="flex items-start gap-1.5 text-xs text-destructive">
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {ledgerMessage(result.code)}{" "}
        <span className="font-mono font-medium opacity-70">({result.code})</span>
      </span>
    </div>
  );
}

// Whether the seat's account has a credential the issuer granted but the subject has not yet accepted
// — the only case where the accept action is relevant. Tolerates a state without credential info (an
// engine that predates the field) by treating it as "nothing pending".
function isCredentialPending(seat: SeatSummary, state: SessionState): boolean {
  return (state.credentials ?? []).some((c) => c.address === seat.address && c.status === "pending");
}

function DepositorActions({ credentialPending, onAct }: { credentialPending: boolean; onAct: ActFn }) {
  return (
    <div className="space-y-4">
      {credentialPending && (
        <PlainAction
          label="Accept credential"
          cta="Accept credential"
          action="accept-credential"
          variant="default"
          hint="The issuer granted you a credential — accept it to gain vault access."
          onAct={onAct}
        />
      )}
      <ActionRow label="Deposit" placeholder="Amount" cta="Deposit" action="deposit" onAct={onAct} />
      <ActionRow label="Withdraw" placeholder="Amount" cta="Withdraw" action="withdraw" variant="outline" onAct={onAct} />
      <p className="text-xs text-muted-foreground">
        Deposits are only accepted from a credentialed account — a deposit without an accepted
        credential is rejected on-ledger.
      </p>
    </div>
  );
}

// A titled group of actions within a role panel, separated from what precedes it. Used to lay a
// multi-surface role (like the owner) out as one scrollable panel instead of hidden tabs.
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <Separator />
      <div className="space-y-0.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// A compact duration like "2m 05s" or "45s", for how long until a loan becomes defaultable.
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${String(rem).padStart(2, "0")}s` : `${m}m`;
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
  credentialPending,
  onAct,
}: {
  seat: SeatSummary;
  state: SessionState;
  credentialPending: boolean;
  onAct: ActFn;
}) {
  // A borrower repays one of their own outstanding loans. Loans are held under the borrower's account,
  // so only loans for this seat's address are offered. Selecting a loan prefills the amount with its
  // outstanding balance, because the ledger rejects a payment below the amount due.
  const myLoans = state.loans.filter((l) => l.borrower === seat.address && !l.defaulted);
  const outstandingByLoan = Object.fromEntries(myLoans.map((l) => [l.loanId, l.totalOutstanding]));
  const alreadyBorrowing = myLoans.length > 0;
  const coverAvailable = state.broker?.coverAvailable;
  // The effective cap is ~80% of raw cover headroom (cover backs principal plus accruing interest), so
  // surface the discounted figure, not the raw ceiling, to avoid repeated tecLIMIT_EXCEEDED.
  const coverHint = coverAvailable
    ? `The broker's owner account signs this on your behalf. Requestable up to about ${(Number(coverAvailable) * 0.8).toFixed(2)} (limited by liquidity and first-loss cover).`
    : "The broker's owner account signs this on your behalf. Bounded by vault liquidity and first-loss cover.";
  return (
    <div className="space-y-4">
      {credentialPending && (
        <PlainAction
          label="Accept credential"
          cta="Accept credential"
          action="accept-credential"
          variant="default"
          hint="The issuer granted you a credential — accept it to borrow."
          onAct={onAct}
        />
      )}
      {alreadyBorrowing ? (
        <div className="space-y-1.5">
          <Label>Request a loan</Label>
          <p className="text-xs text-muted-foreground">You already have an active loan — repay it before requesting another.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <ActionRow label="Request a loan" placeholder="Principal" cta="Request" action="request-loan" onAct={onAct} />
          <p className="text-xs text-muted-foreground">{coverHint}</p>
        </div>
      )}
      <SelectActionRow
        label="Repay a loan"
        choices={loanChoices(myLoans)}
        choiceParam="loanId"
        choicePlaceholder="Select a loan"
        amountParam="amount"
        amountPlaceholder="Amount"
        amountByChoice={outstandingByLoan}
        amountHint={(loanId) =>
          outstandingByLoan[loanId] ? `Amount due: ${outstandingByLoan[loanId]} — pay at least this.` : undefined
        }
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

// The participants a credential can be issued to or revoked from: the pooled depositor and borrower
// accounts. The option value is the on-ledger address (the credential subject); the label is readable.
function participantChoices(allSeats: SeatSummary[]): Choice[] {
  return allSeats
    .filter((s) => s.role === "depositor" || s.role === "borrower")
    .map((s) => ({ value: s.address, label: `${seatLabel(s)} · ${shortId(s.address)}` }));
}

// The currency issuer mints and distributes the vault's issued asset. Those steps run once during
// provisioning; there is no ongoing human action, so the panel just explains the account's role and the
// deliberate separation from the credential issuer.
function CurrencyIssuerActions() {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
      This account mints and distributes the vault&apos;s issued asset. Minting and distribution happen
      once at provisioning, so there is nothing to do here by hand. It is kept separate from the
      credential issuer on purpose — so the raw ledger stays legible. An XRP vault has no currency issuer
      at all.
    </div>
  );
}

function CredentialIssuerActions({ allSeats, onAct }: { allSeats: SeatSummary[]; onAct: ActFn }) {
  const subjects = participantChoices(allSeats);
  return (
    <div className="space-y-4">
      <SelectActionRow
        label="Issue credential"
        choices={subjects}
        choiceParam="subject"
        choicePlaceholder="Select a participant"
        cta="Issue"
        action="issue-credential"
        onAct={onAct}
        emptyHint="No participants to credential."
      />
      <p className="text-xs text-muted-foreground">
        Issuing is only half the handshake — the participant must then accept the credential before it
        grants vault access.
      </p>
      <SelectActionRow
        label="Revoke credential"
        choices={subjects}
        choiceParam="subject"
        choicePlaceholder="Select a participant"
        cta="Revoke"
        action="revoke-credential"
        variant="outline"
        onAct={onAct}
        emptyHint="No participants to revoke."
      />
      <p className="text-xs text-muted-foreground">
        Revoking cuts off access immediately — that account&apos;s next deposit or borrow is rejected
        on-ledger with tecNO_AUTH.
      </p>
    </div>
  );
}

// Origination collects the full loan terms — principal, interest rate, payment interval, grace period,
// and term (number of payments) — and dual-signs a LoanSet. The rate is entered as a human percent and
// converted to the ledger's 1/10th-bp scale (100000 = 100%) before sending, matching the broker-rate
// fields on the new-session form. Term is optional: blank omits PaymentTotal so the ledger derives the
// schedule, exactly as today. Defaults (50% / 60s / 60s / blank) reproduce the engine's current
// defaults, so an untouched form originates a loan identical to before.
function OriginateForm({
  state,
  onAct,
  defaults,
}: {
  state: SessionState;
  onAct: ActFn;
  defaults?: SessionConfig["loanDefaults"];
}) {
  const choices = borrowerChoices(state.seats);
  const [borrower, setBorrower] = useState("");
  const [amount, setAmount] = useState("");
  // Pre-fill from the session's default loan terms when present, so the originator sees the inherited
  // value rather than the engine's baked-in defaults. interestRate is stored scaled (100000 = 100%).
  const [ratePct, setRatePct] = useState(defaults?.interestRate !== undefined ? String(defaults.interestRate / 1000) : "50");
  const [interval, setIntervalValue] = useState(defaults?.paymentInterval !== undefined ? String(defaults.paymentInterval) : "60");
  const [grace, setGrace] = useState(defaults?.gracePeriod !== undefined ? String(defaults.gracePeriod) : "60");
  const [term, setTerm] = useState(defaults?.paymentTotal !== undefined ? String(defaults.paymentTotal) : "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const selected = borrower || (choices.length === 1 ? choices[0].value : "");
  const intervalN = Number(interval);
  const graceN = Number(grace);
  const ratePctN = Number(ratePct);
  // Mirror the ledger's LoanSet validation client-side so bad terms are blocked before a round-trip
  // rather than returning an opaque temMALFORMED/temINVALID. Rate 0..100% (0..100000 scaled), interval
  // >= 60s, grace <= interval, term (if given) a positive whole number.
  const errors: string[] = [];
  if (!(ratePctN >= 0 && ratePctN <= 100)) errors.push("Interest rate must be between 0% and 100%.");
  if (!(intervalN >= 60)) errors.push("Payment interval must be at least 60 seconds.");
  if (!(graceN <= intervalN)) errors.push("Grace period cannot exceed the payment interval.");
  if (term.trim() && !(Number.isInteger(Number(term)) && Number(term) > 0))
    errors.push("Term must be a positive whole number of payments.");
  const ready = Boolean(selected) && amount.trim().length > 0 && errors.length === 0;

  async function submit() {
    if (!ready || pending) return;
    setPending(true);
    setResult(null);
    const params: Record<string, string> = {
      borrower: selected,
      amount: amount.trim(),
      interestRate: String(Math.round(ratePctN * 1000)),
      interval: interval.trim(),
      grace: grace.trim(),
    };
    if (term.trim()) params.paymentTotal = term.trim();
    const res = await onAct("originate", params);
    setResult(res);
    setPending(false);
    if (res.ok) setAmount("");
  }

  if (choices.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label>Originate a loan</Label>
        <p className="text-xs text-muted-foreground">No borrowers in this session.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Originate a loan</Label>
      <Select value={selected} onValueChange={(v) => { setBorrower(v); setResult(null); }} disabled={pending}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder="Select a borrower" className="truncate" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-9"
        placeholder="Principal"
        value={amount}
        disabled={pending}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Interest rate (%)</span>
          <Input className="h-8" type="number" min={0} max={100} value={ratePct} disabled={pending} onChange={(e) => setRatePct(e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Term (# payments)</span>
          <Input className="h-8" type="number" min={1} placeholder="Ledger default" value={term} disabled={pending} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Payment interval (s)</span>
          <Input className="h-8" type="number" min={60} value={interval} disabled={pending} onChange={(e) => setIntervalValue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Grace period (s)</span>
          <Input className="h-8" type="number" min={0} value={grace} disabled={pending} onChange={(e) => setGrace(e.target.value)} />
        </div>
      </div>
      <Button className="w-full" disabled={pending || !ready} onClick={submit}>
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        Originate
      </Button>
      {errors.length > 0 && <p className="text-xs text-destructive">{errors[0]}</p>}
      <ResultLine result={result} />
    </div>
  );
}

function OwnerActions({
  state,
  onAct,
  loanDefaults,
}: {
  state: SessionState;
  onAct: ActFn;
  loanDefaults?: SessionConfig["loanDefaults"];
}) {
  const activeLoans = state.loans.filter((l) => !l.defaulted && l.paymentRemaining > 0);
  // Only loans that are actually delinquent (overdue past grace) can be defaulted — offering others
  // would just earn a tecTOO_SOON rejection. The rest inform a hint about when they become defaultable.
  const defaultable = activeLoans.filter((l) => l.defaultableNow);
  const soonest = activeLoans
    .filter((l) => !l.defaultableNow && typeof l.defaultableInSeconds === "number")
    .map((l) => l.defaultableInSeconds as number)
    .sort((a, b) => a - b)[0];
  const defaultEmptyHint =
    activeLoans.length === 0
      ? "No active loans to default."
      : soonest !== undefined
        ? `No loans are delinquent yet — the soonest is defaultable in ~${formatDuration(soonest)}.`
        : "No loans are delinquent yet.";
  // The owner's two role surfaces are shown as sections in one panel, so every action is visible at
  // once rather than hidden behind a tab.
  return (
    <div className="space-y-4">
      <Section title="Vault Manager" hint="Configure the vault and the credential its permissioned domain accepts.">
        <ActionRow label="Set maximum assets" placeholder="Amount" cta="Update" action="set-max-assets" onAct={onAct} />
        <ActionRow label="Accepted credential type" placeholder="e.g. LENDPARTY" cta="Set domain" action="set-domain" param="domain" variant="outline" onAct={onAct} />
      </Section>

      <Section title="Loan Originator" hint="Lend vault liquidity to borrowers, and default loans that fall delinquent.">
        <OriginateForm state={state} onAct={onAct} defaults={loanDefaults} />
        <p className="text-xs text-muted-foreground">
          Origination is bilateral — the borrower counter-signs the same transaction. Interest rate,
          payment interval, and grace period set the loan&apos;s terms; leave Term blank to let the
          ledger derive the payment schedule.
        </p>
        <ActionRow
          label="Deposit first-loss cover"
          placeholder="Amount"
          cta="Deposit cover"
          action="deposit-cover"
          variant="outline"
          onAct={onAct}
        />
        <p className="text-xs text-muted-foreground">
          Loans must stay backed by cover, so lending is capped by it. Current cover:{" "}
          <span className="font-mono">{state.broker?.coverAvailable ?? "—"}</span>. Add more to raise
          how much you can originate.
        </p>
        <SelectActionRow
          label="Default a delinquent loan"
          choices={loanChoices(defaultable)}
          choiceParam="loanId"
          choicePlaceholder="Select a loan"
          cta="Default"
          action="manage-loan"
          variant="outline"
          onAct={onAct}
          emptyHint={defaultEmptyHint}
        />
      </Section>
    </div>
  );
}
