"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { engine } from "@/lib/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Join an existing session by its id. There is no public directory — a session is private to whoever
// holds its id, so joining means pasting the id someone shared. The id is verified against the engine
// before navigating, so a bad id fails here with a clear message rather than landing on a dead page.
export function JoinSessionForm() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    const trimmed = id.trim();
    if (!trimmed) {
      setError("Enter a session id.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const session = await engine.getSession(trimmed);
      router.push(`/sessions/${session.setupId}`);
    } catch {
      setError("No session found with that id. Check it and try again.");
      setChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Join a session</h1>
        <p className="text-sm text-muted-foreground">
          Sessions are private to whoever holds the id. Paste the id someone shared to join theirs and
          take a role alongside them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="h-4 w-4 text-muted-foreground" /> Session id
          </CardTitle>
          <CardDescription>The identifier from the session you were invited to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-id">Session id</Label>
            <Input
              id="session-id"
              placeholder="session-…"
              className="font-mono"
              value={id}
              disabled={checking}
              onChange={(e) => {
                setId(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && !checking && join()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button variant="outline" asChild>
              <Link href="/">Cancel</Link>
            </Button>
            <Button onClick={join} disabled={checking}>
              {checking ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Checking…
                </>
              ) : (
                <>
                  Join session <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an id?{" "}
        <Link href="/sessions/new" className="underline underline-offset-2 hover:text-foreground">
          Create a session
        </Link>{" "}
        instead.
      </p>
    </div>
  );
}
