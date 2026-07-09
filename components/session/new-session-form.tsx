"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Boxes, Coins, Bot } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { engine } from "@/lib/client";
import { ProvisioningView } from "./provisioning-view";

const SCENARIOS = [
  { id: "calm", label: "Calm", hint: "Borrowers pay on time; depositors hold." },
  { id: "mixed", label: "Mixed", hint: "A spread of on-time, late, and defaulting borrowers." },
  { id: "defaults", label: "Defaults-heavy", hint: "Weighted toward defaults to exercise the loss path." },
];

export function NewSessionForm() {
  const router = useRouter();
  const [provisioning, setProvisioning] = useState(false);
  const [scenario, setScenario] = useState("mixed");
  const [form, setForm] = useState({
    label: "",
    asset: "RLUSD",
    depositors: "2",
    borrowers: "1",
    cover: "20000",
    term: "60",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Once provisioning starts, the form is replaced by the deployment progress view until the session
  // is live and we navigate to it (or provisioning fails and we return to the form).
  if (provisioning) {
    return <ProvisioningView label={form.label.trim() || undefined} />;
  }

  async function provision() {
    setProvisioning(true);
    try {
      const session = await engine.createSession({
        label: form.label.trim() || undefined,
        asset: form.asset.trim() || undefined,
        depositors: Number(form.depositors),
        borrowers: Number(form.borrowers),
        coverAmount: form.cover.trim() || undefined,
        paymentInterval: Number(form.term),
        scenario,
      });
      toast.success("Session provisioned", {
        description: "Accounts, credentials, vault, and cover are live on Devnet.",
      });
      router.push(`/sessions/${session.setupId}`);
    } catch {
      toast.error("Provisioning failed", { description: "Please try again." });
      setProvisioning(false);
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
          Configure the environment. Provisioning creates the accounts, credentials, domain, vault,
          broker, and cover on Devnet.
        </p>
      </div>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4 text-muted-foreground" /> Environment
          </CardTitle>
          <CardDescription>The vault asset and participant pools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Label (optional)">
            <Input placeholder="e.g. demo" value={form.label} onChange={set("label")} />
          </Field>
          <Field label="Vault asset">
            <Input value={form.asset} onChange={set("asset")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Depositors">
              <Input type="number" min={1} value={form.depositors} onChange={set("depositors")} />
            </Field>
            <Field label="Borrowers">
              <Input type="number" min={1} value={form.borrowers} onChange={set("borrowers")} />
            </Field>
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="First-loss cover">
              <Input value={form.cover} onChange={set("cover")} />
            </Field>
            <Field label="Payment interval (s)">
              <Input type="number" min={60} value={form.term} onChange={set("term")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Bots */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-muted-foreground" /> Bot behavior
          </CardTitle>
          <CardDescription>How the agents filling unheld seats behave.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
