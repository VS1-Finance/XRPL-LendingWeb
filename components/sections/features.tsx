import { ShieldCheck, Coins, Users, Activity, Layers, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";

const features = [
  {
    icon: ShieldCheck,
    title: "Credential-gated access",
    body: "Only accounts holding an accepted credential can participate. Enforcement happens on-ledger, through a permissioned domain — never in the application layer.",
  },
  {
    icon: Coins,
    title: "Pooled, yield-bearing liquidity",
    body: "Depositors supply a single-asset vault and hold shares that accrue value as loans earn interest, backed by a broker's first-loss capital.",
  },
  {
    icon: Users,
    title: "Any role, bots fill the rest",
    body: "Assume any role — issuer, depositor, vault manager, originator, or borrower — while deterministic agents keep every other seat active.",
  },
  {
    icon: Activity,
    title: "Observable end to end",
    body: "Every origination, repayment, and default settles as a validated transaction on the XRP Ledger, fully auditable as it happens.",
  },
  {
    icon: Repeat,
    title: "Bilateral origination",
    body: "Loans open with a dual-signed transaction; principal is delivered to the borrower inside the same operation, with no separate draw.",
  },
  {
    icon: Layers,
    title: "Atomic setup — XLS-56 Batch",
    body: "The cross-account steps that stand the market up — a member's credential handshake, a holder's trust line and distribution — each commit as one all-or-nothing Batch transaction. The market is never left half-provisioned.",
  },
];

export function Features() {
  return (
    <Section className="py-16 sm:py-24">
      <div className="mx-auto max-w-container px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
            A complete lending market, enforced on-ledger
          </h2>
          <p className="mt-4 text-muted-foreground">
            Five amendments composed into one working market — identity, gating, capital, origination,
            and the atomic setup that binds them — with protocol-level guarantees at every step.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card
              key={f.title}
              className="group relative overflow-hidden p-6 transition-all hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40 text-foreground transition-colors group-hover:bg-muted">
                <f.icon className="h-6 w-6 stroke-[1.5]" />
              </div>
              <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
