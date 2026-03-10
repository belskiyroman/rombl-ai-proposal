"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { GenerationSnapshotData } from "@/src/lib/generation-snapshot";
import { GenerationSnapshotView } from "@/src/components/GenerationSnapshotView";
import { Button } from "@/src/components/ui/button";

export default function GenerateHistoryDetailPage() {
  const params = useParams();
  const id = params.id as Id<"generation_runs">;

  const run = useQuery(api.runs.getGenerationRun, { id }) as GenerationSnapshotData | null | undefined;

  return (
    <main className="min-h-[calc(100vh-52px)]">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Run Snapshot</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Saved Run Detail</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Immutable generation snapshot with saved retrieval context and evaluator trace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/generate/history">Back to History</Link>
            </Button>
            <Button asChild>
              <Link href="/generate">Open Generator</Link>
            </Button>
          </div>
        </div>

        {run === undefined ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              <p className="text-sm">Loading saved run...</p>
            </div>
          </div>
        ) : run === null ? (
          <div className="glass-card p-8 text-center">
            <p className="font-medium text-destructive">Saved run not found.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This generation snapshot may have been removed or never existed.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/generate/history">Back to History</Link>
            </Button>
          </div>
        ) : (
          <GenerationSnapshotView snapshot={run} />
        )}
      </div>
    </main>
  );
}
