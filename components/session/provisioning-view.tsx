"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// The deployment steps the engine performs when provisioning a session, in order. Shown as a live
// checklist so the wait (the real engine takes ~90s on Devnet) is legible rather than a blank spinner.
const STEPS = [
  "Funding participant accounts",
  "Issuing access credentials",
  "Configuring the permissioned domain",
  "Creating the single-asset vault",
  "Depositing first-loss cover",
  "Starting the bot pool",
];

// A provisioning progress screen. It advances through the steps on a timer for legibility; the actual
// completion is driven by the caller (when createSession resolves), which unmounts this view. The
// timer only paces the visual checklist — it never gates navigation.
export function ProvisioningView({ label }: { label?: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Pace the checklist across a plausible provisioning window; hold on the last step until the
    // caller navigates away. Interval is derived from the step count so it reads smoothly.
    const timer = setInterval(() => {
      setActive((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Provisioning session</h1>
        <p className="text-sm text-muted-foreground">
          {label ? `Deploying “${label}” on the XRP Ledger Devnet.` : "Deploying on the XRP Ledger Devnet."}{" "}
          This takes a moment — the accounts and objects are created on-ledger.
        </p>
      </div>

      <Card>
        <CardContent className="py-5">
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const done = i < active;
              const current = i === active;
              return (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {done ? (
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : current ? (
                      <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </span>
                  <span
                    className={
                      done
                        ? "text-sm text-muted-foreground"
                        : current
                          ? "text-sm font-medium"
                          : "text-sm text-muted-foreground/50"
                    }
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be taken to the session as soon as it&apos;s live.
      </p>
    </div>
  );
}
