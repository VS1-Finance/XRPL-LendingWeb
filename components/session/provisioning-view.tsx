"use client";

import { Check, Loader2, ExternalLink } from "lucide-react";
import type { ProvisionStep } from "@/lib/engine-client";
import { txUrl } from "@/lib/client";
import { Card, CardContent } from "@/components/ui/card";

// A readable label for each provisioning step action. Dynamic per-account steps (distribute-owner,
// credential-create-issuer, trust-depositor, …) are matched by prefix so every step reads cleanly
// without enumerating every account.
function stepLabel(action: string): string {
  const exact: Record<string, string> = {
    "issuer-allow-clawback": "Enable issuer clawback",
    "issuer-default-ripple": "Enable issuer rippling",
    "domain-create": "Create permissioned domain",
    "vault-create": "Create single-asset vault",
    "broker-create": "Create loan broker",
    "cover-deposit": "Deposit first-loss cover",
  };
  if (exact[action]) return exact[action];
  if (action.startsWith("distribute-")) return `Distribute asset to ${action.slice("distribute-".length)}`;
  if (action.startsWith("trust-")) return `Set trust line for ${action.slice("trust-".length)}`;
  if (action.startsWith("credential-create-")) return `Issue credential to ${action.slice("credential-create-".length)}`;
  if (action.startsWith("credential-accept-")) return `Accept credential for ${action.slice("credential-accept-".length)}`;
  // Fall back to a de-hyphenated, sentence-cased version of the action name.
  const words = action.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// A provisioning progress screen. It fills in with each step as the engine settles it — action label,
// a green check, and a link to the settled transaction — so the environment is visibly built step by
// step. The final step remains pending-looking only briefly before the caller navigates to the
// session; a trailing spinner conveys that more may still be coming.
export function ProvisioningView({ label, steps }: { label?: string; steps: ProvisionStep[] }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Provisioning session</h1>
        <p className="text-sm text-muted-foreground">
          {label ? `Deploying “${label}” on the XRP Ledger Devnet.` : "Deploying on the XRP Ledger Devnet."}{" "}
          Each account and object is created on-ledger — the steps appear as they settle.
        </p>
      </div>

      <Card>
        <CardContent className="py-5">
          {steps.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting provisioning…
            </div>
          ) : (
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={`${step.action}-${i}`} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <span className="flex-1 text-sm">
                    {stepLabel(step.action)}
                    {step.skipped && <span className="ml-1.5 text-xs text-muted-foreground">· already present</span>}
                  </span>
                  {step.txHash ? (
                    <a
                      href={txUrl(step.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {step.txHash.slice(0, 8)}…{step.txHash.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">{step.skipped ? "—" : step.result}</span>
                  )}
                </li>
              ))}
              <li className="flex items-center gap-3 pt-1 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Working…
              </li>
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be taken to the session as soon as it&apos;s live.
      </p>
    </div>
  );
}
