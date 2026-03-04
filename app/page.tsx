import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold">Rombl AI Proposal MVP</h1>
        <p className="text-sm text-muted-foreground">System initialization complete.</p>
        <Link href="/ingest">
          <Button>Open Ingestion Dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
