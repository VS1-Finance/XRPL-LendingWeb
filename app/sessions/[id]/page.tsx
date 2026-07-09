import { SessionView } from "@/components/session/session-view";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <SessionView setupId={id} />
    </div>
  );
}
