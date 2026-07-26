import { Suspense } from "react";
import { SessionView } from "@/components/session/session-view";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      {/* SessionView reads a ?claim search param (auto-claim), which requires a Suspense boundary.
          Keying on the id gives each session a fresh instance, so polled state and the live
          "since this page opened" history never carry across a client-side session switch. */}
      <Suspense>
        <SessionView key={id} setupId={id} />
      </Suspense>
    </div>
  );
}
