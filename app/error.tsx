"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert, RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

// The app-level error boundary. Catches unexpected runtime failures — e.g. the engine service being
// unreachable — and offers a retry or a way home rather than a blank screen.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for diagnostics; in production this would go to the monitoring pipeline.
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted/40">
          <TriangleAlert className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. It may be temporary — try again, or head back home.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={reset}>
            <RotateCw className="mr-1.5 h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-1.5 h-4 w-4" /> Back to home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
