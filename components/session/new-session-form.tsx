"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Loader2, Boxes, Coins, Bot, SlidersHorizontal, ShieldCheck, Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { engine } from "@/lib/client";
import type { ProvisionStep } from "@/lib/engine-client";
import { TEMPLATES, GOALS, templateById, type Template, type Goal } from "@/lib/templates";
import { ProvisioningView } from "./provisioning-view";

const SCENARIOS = [
  { id: "calm", label: "Calm", hint: "Borrowers pay on time; depositors hold." },
  { id: "mixed", label: "Mixed", hint: "A spread of on-time, late, and defaulting borrowers." },
  { id: "defaults", label: "Defaults-heavy", hint: "Weighted toward defaults to exercise the loss path." },
];

// The XLS specifications each parameter comes from, linked so a reader can trace a field to the ledger
// amendment that defines it.
const XLS_VAULT = { href: "https://xls.xrpl.org/xls/XLS-0065-single-asset-vault.html", label: "XLS-65" };
const XLS_LENDING = { href: "https://xls.xrpl.org/xls/XLS-0066-lending-protocol.html", label: "XLS-66" };
const XLS_CREDENTIALS = { href: "https://xls.xrpl.org/xls/XLS-0070-credentials.html", label: "XLS-70" };
const XLS_DOMAIN = { href: "https://xls.xrpl.org/xls/XLS-0080-permissioned-domains.html", label: "XLS-80" };

export function NewSessionForm() {
  const router = useRouter();
  const [provisioning, setProvisioning] = useState(false);
  // Synchronous guard against a double-click: `setProvisioning(true)` is async, so two clicks in the
  // same tick would both pass the disabled check and both fire a provision. The ref flips immediately.
  const inFlight = useRef(false);
  const [steps, setSteps] = useState<ProvisionStep[]>([]);
  const [scenario, setScenario] = useState("mixed");
  // Permissioned (domain-gated, credentials required) is the default — it leads with the tecNO_AUTH
  // enforcement story. Public opens the vault to anyone, no credentials.
  const [permissioned, setPermissioned] = useState(true);
  const [form, setForm] = useState({
    label: "",
    // XRP is the frictionless default — no issuer, no trust lines, deposit straight away. Any other
    // value is treated as an issued currency the harness stands up its own issuer for.
    asset: "XRP",
    depositors: "2",
    borrowers: "1",
    cover: "2000",
    // Broker configuration (optional). Rates are percentages; blank keeps the server default.
    coverRate: "",
    liquidationRate: "",
    managementFee: "",
    debtMax: "",
    // Optional bot seed. Blank → the engine generates one. Fixes the variant assignment only.
    botSeed: "",
    // Default loan terms (optional). Applied at origination when the originator leaves a field blank.
    defRate: "",
    defInterval: "",
    defGrace: "",
    defTerm: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const [templateId, setTemplateId] = useState<string | null>(null);
  // Applying a template fills the fields but leaves them editable — it is a starting point, not a lock.
  function applyTemplate(t: Template) {
    setTemplateId(t.id);
    setPermissioned(t.values.permissioned);
    setScenario(t.values.scenario);
    // debtMax defaults to "" when the template omits it, so switching off an XRP preset clears the
    // preset's ceiling rather than leaking it into the next (e.g. IOU) template.
    setForm((f) => ({ ...f, asset: t.values.asset, depositors: t.values.depositors, borrowers: t.values.borrowers, cover: t.values.cover, debtMax: t.values.debtMax ?? "" }));
  }

  // The chosen goal — its template configures the market and its role is auto-claimed on arrival.
  const [goalId, setGoalId] = useState<string | null>(null);
  function applyGoal(g: Goal) {
    setGoalId(g.id);
    const t = templateById(g.templateId);
    if (t) applyTemplate(t);
  }
  const claimRole = goalId ? GOALS.find((g) => g.id === goalId)?.claimRole : undefined;

  // Once provisioning starts, the form is replaced by the deployment progress view, which fills in
  // with each step as the engine settles it, until the session is live and we navigate to it (or
  // provisioning fails and we return to the form).
  if (provisioning) {
    return <ProvisioningView label={form.label.trim() || undefined} steps={steps} />;
  }

  // Validate the required fields before touching the ledger. Returns an error message, or null when the
  // form is provisionable. Pools must be positive whole numbers; cover must be a positive amount.
  function validate(): string | null {
    const depositors = Number(form.depositors);
    const borrowers = Number(form.borrowers);
    if (!Number.isInteger(depositors) || depositors < 1) return "Depositors must be a whole number of at least 1.";
    if (!Number.isInteger(borrowers) || borrowers < 1) return "Borrowers must be a whole number of at least 1.";
    const cover = Number(form.cover);
    if (!form.cover.trim() || !Number.isFinite(cover) || cover <= 0) return "First-loss cover must be a positive amount.";
    if (!form.asset.trim()) return "Vault asset is required (use XRP for a native vault).";
    return null;
  }

  async function provision() {
    // Reentrancy guard (see `inFlight`): reject a second click while a provision is already running.
    if (inFlight.current) return;
    const error = validate();
    if (error) {
      toast.error("Check the form", { description: error });
      return;
    }
    inFlight.current = true;
    setProvisioning(true);
    setSteps([]);
    try {
      const session = await engine.createSession(
        {
          label: form.label.trim() || undefined,
          asset: form.asset.trim() || undefined,
          permissioned,
          depositors: Number(form.depositors),
          borrowers: Number(form.borrowers),
          coverAmount: form.cover.trim() || undefined,
          scenario,
          coverRatePercent: form.coverRate.trim() ? Number(form.coverRate) : undefined,
          liquidationRatePercent: form.liquidationRate.trim() ? Number(form.liquidationRate) : undefined,
          managementFeePercent: form.managementFee.trim() ? Number(form.managementFee) : undefined,
          debtMaximum: form.debtMax.trim() || undefined,
          botSeed: form.botSeed.trim() || undefined,
          interestRatePercent: form.defRate.trim() ? Number(form.defRate) : undefined,
          paymentInterval: form.defInterval.trim() ? Number(form.defInterval) : undefined,
          gracePeriod: form.defGrace.trim() ? Number(form.defGrace) : undefined,
          paymentTotal: form.defTerm.trim() ? Number(form.defTerm) : undefined,
        },
        (step) => setSteps((prev) => [...prev, step]),
      );
      // The completion message reflects what was actually stood up: a public vault has no credentials.
      toast.success("Session provisioned", {
        description: permissioned
          ? "Accounts, credentials, vault, and cover are live on Devnet."
          : "Accounts, vault, and cover are live on Devnet.",
      });
      // Carry the goal's role so the session view can auto-claim the matching seat on arrival.
      const claim = claimRole ? `?claim=${encodeURIComponent(claimRole)}` : "";
      router.push(`/sessions/${session.setupId}${claim}`);
    } catch {
      toast.error("Provisioning failed", { description: "Please try again." });
      setProvisioning(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New session</h1>
        <p className="text-sm text-muted-foreground">
          Configure the market. Provisioning stands up the accounts, vault, broker, and cover on Devnet
          — plus a permissioned domain and credentials when access is gated.
        </p>
      </div>

      {/* Goal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What do you want to do?</CardTitle>
          <CardDescription>
            Pick a goal and we&apos;ll set up a fitting market and drop you into the right seat. Or skip
            this and configure everything below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => applyGoal(g)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  goalId === g.id ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30"
                }`}
              >
                <div className="text-sm font-medium">{g.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{g.summary}</div>
              </button>
            ))}
          </div>
          {claimRole && (
            <p className="mt-3 text-xs text-muted-foreground">
              On arrival you&apos;ll be seated automatically. Adjust anything below first if you like.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start from a template</CardTitle>
          <CardDescription>A one-click preset. Every field below stays editable.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  templateId === t.id ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30"
                }`}
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t.summary}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4 text-muted-foreground" /> Environment
          </CardTitle>
          <CardDescription>The vault asset and participant pools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Label">
            <Input placeholder="e.g. demo" value={form.label} onChange={set("label")} />
          </Field>
          <Field label="Vault asset" required doc={XLS_VAULT} hint="XRP is the frictionless default — no issuer or trust lines. Enter a 3-letter or hex currency code (e.g. USD) to use an issued token instead.">
            <Input value={form.asset} onChange={set("asset")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Depositors" required>
              <Input type="number" min={1} max={20} value={form.depositors} onChange={set("depositors")} />
            </Field>
            <Field label="Borrowers" required>
              <Input type="number" min={1} max={20} value={form.borrowers} onChange={set("borrowers")} />
            </Field>
          </div>
          {Number(form.depositors) + Number(form.borrowers) > 10 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Large pools take longer to provision — each participant is a funded Devnet account with
              credentials, so this can take several minutes. Capped at 20 per side.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Access
            <span className="ml-auto flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <a href={XLS_CREDENTIALS.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                {XLS_CREDENTIALS.label} <ExternalLink className="h-3 w-3" />
              </a>
              <a href={XLS_DOMAIN.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                {XLS_DOMAIN.label} <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </CardTitle>
          <CardDescription>Who may deposit into the vault.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPermissioned(true)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                permissioned ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-4 w-4" /> Permissioned
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                A credential gates the vault. Only credentialed accounts may deposit — an uncredentialed
                deposit is rejected with tecNO_AUTH.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPermissioned(false)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                !permissioned ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Globe className="h-4 w-4" /> Public
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                An open vault. Anyone may deposit without a credential — no domain, no credential issuer.
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Lending parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-muted-foreground" /> Lending parameters
          </CardTitle>
          <CardDescription>Cover and loan timing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="First-loss cover" required doc={XLS_LENDING} hint="Capital the owner seeds to back loans. A loan must stay within the cover at the minimum cover rate, so this caps how much can be originated.">
            <Input value={form.cover} onChange={set("cover")} />
          </Field>
        </CardContent>
      </Card>

      {/* Advanced settings — collapsed by default so the common path stays short. Everything here has a
          working default; expand only to tune the broker or the bot mix. */}
      <details className="group rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Advanced settings
          <span className="text-xs font-normal text-muted-foreground">broker rates, bot behavior</span>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t p-4">
          {/* Broker configuration (optional) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              Broker configuration
              <a href={XLS_LENDING.href} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground hover:text-foreground">
                {XLS_LENDING.label} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Management fee (%)">
                <Input type="number" min={0} placeholder="e.g. 1.0" value={form.managementFee} onChange={set("managementFee")} />
              </Field>
              <Field label="Max debt">
                <Input placeholder="Unlimited" value={form.debtMax} onChange={set("debtMax")} />
              </Field>
              <Field label="Min cover rate (%)">
                <Input type="number" min={0} placeholder="e.g. 100" value={form.coverRate} onChange={set("coverRate")} />
              </Field>
              <Field label="Liquidation rate (%)">
                <Input type="number" min={0} placeholder="e.g. 100" value={form.liquidationRate} onChange={set("liquidationRate")} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Min cover rate is how much first-loss cover must back each loan — lower it to originate more
              against the same cover. Liquidation rate cannot exceed the min cover rate.
            </p>
          </div>

          {/* Default loan terms (optional) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              Default loan terms
              <a href={XLS_LENDING.href} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground hover:text-foreground">
                {XLS_LENDING.label} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default interest rate (%)" hint="Applied to new loans when the originator leaves it blank. Blank uses the engine default (50%).">
                <Input type="number" min={0} max={100} placeholder="50" value={form.defRate} onChange={set("defRate")} />
              </Field>
              <Field label="Default term (# payments)" hint="Blank lets the ledger derive the schedule.">
                <Input type="number" min={1} placeholder="Ledger default" value={form.defTerm} onChange={set("defTerm")} />
              </Field>
              <Field label="Default payment interval (s)" hint="Minimum 60. Blank uses 60.">
                <Input type="number" min={60} placeholder="60" value={form.defInterval} onChange={set("defInterval")} />
              </Field>
              <Field label="Default grace period (s)" hint="Must not exceed the interval. Blank uses 60.">
                <Input type="number" min={0} placeholder="60" value={form.defGrace} onChange={set("defGrace")} />
              </Field>
            </div>
          </div>

          {/* Bot behavior */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4 text-muted-foreground" /> Bot behavior
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenario(s.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    scenario === s.id ? "border-foreground/40 bg-muted/40" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
                </button>
              ))}
            </div>
            <Field label="Seed" hint="Fixes which behaviour each bot runs, so the same seed reproduces the same variant mix. Leave blank to generate one — it's shown on the session's Info tab to copy and re-use. Action timing still varies run to run.">
              <Input placeholder="Auto-generated if blank" value={form.botSeed} onChange={set("botSeed")} />
            </Field>
          </div>
        </div>
      </details>

      <Separator />

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/">Cancel</Link>
        </Button>
        <Button onClick={provision} disabled={provisioning}>
          {provisioning ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Provisioning…
            </>
          ) : (
            "Provision session"
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  doc,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  doc?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        <span className="text-xs font-normal text-muted-foreground">{required ? "required" : "optional"}</span>
        {doc && (
          <a
            href={doc.href}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 text-xs font-normal text-muted-foreground hover:text-foreground"
          >
            {doc.label} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
