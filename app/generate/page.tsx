"use client";

import Link from "next/link";
import { Suspense, useState } from "react";

import type { GenerationSnapshotData } from "@/src/lib/generation-snapshot";
import { GenerationForm } from "@/src/components/GenerationForm";
import { GeneratedResult } from "@/src/components/GeneratedResult";
import { Button } from "@/src/components/ui/button";

export default function GeneratePage() {
  const [generatedResult, setGeneratedResult] = useState<GenerationSnapshotData | null>(null);

  return (
    <main className="min-h-[calc(100vh-52px)]">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Generation Console</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Grounded Generator</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a proposal from structured job understanding, candidate evidence, canonical cases, and curated fragments.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/generate/history">Saved Runs</Link>
          </Button>
        </div>

        <Suspense
          fallback={
            <div className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              Loading generator form...
            </div>
          }
        >
          <GenerationForm onGenerated={setGeneratedResult} />
        </Suspense>
        <GeneratedResult result={generatedResult} />
      </div>
    </main>
  );
}
