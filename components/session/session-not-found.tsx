import Link from "next/link";
import { SearchX, Plus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown when a session id does not resolve — a mistyped or shared-but-gone id, or a session lost to a
// Devnet reset. Gives the two ways forward: create a fresh session, or try another id.
export function SessionNotFound({ setupId }: { setupId?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted/40">
        <SearchX className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Session not found</h1>
        <p className="text-sm text-muted-foreground">
          {setupId ? (
            <>
              No session resolves to <span className="font-mono text-xs">{setupId}</span>. It may have
              been mistyped, or lost to a Devnet reset.
            </>
          ) : (
            <>That session id does not resolve. It may have been mistyped, or lost to a Devnet reset.</>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Button asChild>
          <Link href="/sessions/new">
            <Plus className="mr-1.5 h-4 w-4" /> Create a session
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/join">
            <LogIn className="mr-1.5 h-4 w-4" /> Try another id
          </Link>
        </Button>
      </div>
    </div>
  );
}
