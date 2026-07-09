import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex-1">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted/40">
          <Compass className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you were looking for doesn&apos;t exist.
          </p>
        </div>
        <Button asChild className="mt-2">
          <Link href="/">
            <Home className="mr-1.5 h-4 w-4" /> Back to home
          </Link>
        </Button>
      </div>
    </main>
  );
}
