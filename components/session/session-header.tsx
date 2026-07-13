"use client";

import { useState } from "react";
import { Play, Square, Copy, Check, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SessionHeader({
  setupId,
  network,
  participant,
  botsRunning,
  onToggleBots,
}: {
  setupId: string;
  network: string;
  participant: string;
  botsRunning: boolean;
  onToggleBots: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(setupId);
      setCopied(true);
      toast.success("Session id copied", { description: "Share it so someone can join this session." });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-lg font-semibold tracking-tight">{setupId}</h1>
          <Badge variant="secondary">{network}</Badge>
          <button
            type="button"
            onClick={copyId}
            className="text-muted-foreground hover:text-foreground"
            title="Copy session id"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <User className="h-3 w-3" /> {participant}
          </Badge>
          {/* Green to start the pool, red to stop it — explicit classes defined in globals.css so the
              colours never depend on the utility palette or the button variant's own background. */}
          <Button
            variant="secondary"
            onClick={onToggleBots}
            className={botsRunning ? "btn-bot-stop" : "btn-bot-start"}
          >
            {botsRunning ? (
              <>
                <Square className="mr-1.5 h-4 w-4" /> Stop bots
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-4 w-4" /> Start bots
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Claim a role to act as that participant. Bots keep every other seat active.
      </p>
    </div>
  );
}
