import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold">Rombl AI Proposal MVP</h1>
        <p className="text-sm text-neutral-600">System initialization complete.</p>
        <Button>Open Dashboard</Button>
      </div>
    </main>
  );
}
