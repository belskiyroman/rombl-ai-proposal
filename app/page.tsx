import Link from "next/link";
import { Button } from "@/src/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-[calc(100vh-52px)] flex items-center justify-center relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-info/[0.04] blur-[100px] pointer-events-none" />

      <div className="relative z-10 space-y-10 text-center px-6 animate-slide-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-2xl font-bold text-white shadow-xl shadow-primary/25">
          R
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="gradient-text">Structured Proposal Engine</span>
          </h1>
          <p className="max-w-lg mx-auto text-sm text-muted-foreground leading-relaxed">
            Grounded proposal generation powered by canonical cases, fragments, and candidate evidence
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/pairs" className="glass-card-hover p-6 w-52 text-left group">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary/80 mb-2">Library</div>
            <p className="text-sm text-muted-foreground">Browse canonical cases and clusters</p>
          </Link>

          <Link href="/ingest" className="glass-card-hover p-6 w-52 text-left group">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary/80 mb-2">Candidates</div>
            <p className="text-sm text-muted-foreground">Manage profiles and evidence</p>
          </Link>

          <Link href="/generate" className="glass-card-hover p-6 w-52 text-left group">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary/80 mb-2">Generator</div>
            <p className="text-sm text-muted-foreground">Create grounded proposals</p>
          </Link>
        </div>

        <Link href="/generate">
          <Button size="lg" className="shadow-lg shadow-primary/20 mt-2">
            Open Generator
          </Button>
        </Link>
      </div>
    </main>
  );
}
