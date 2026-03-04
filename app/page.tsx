import Link from "next/link";
import { Button } from "@/src/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 p-6">
      <div className="space-y-6 text-center animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold shadow-lg">
          R
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Rombl AI Proposal</h1>
          <p className="text-sm text-muted-foreground">RAG-based Proposal Generation System</p>
        </div>
        <Link href="/ingest">
          <Button size="lg" className="shadow-md mt-2">
            Open Ingestion Dashboard
          </Button>
        </Link>
      </div>
    </main>
  );
}
