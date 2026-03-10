"use client";

import Link from "next/link";
import { useState } from "react";

import type { GenerationSnapshotData } from "@/src/lib/generation-snapshot";
import { GenerationForm } from "@/src/components/GenerationForm";
import { GeneratedResult } from "@/src/components/GeneratedResult";
import { Button } from "@/src/components/ui/button";

export default function GeneratePage() {
  const [generatedResult, setGeneratedResult] = useState<GenerationSnapshotData | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Grounded Generator</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a proposal from structured job understanding, candidate evidence, canonical cases, and curated fragments.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/generate/history">Saved Runs</Link>
          </Button>
        </div>

        <GenerationForm onGenerated={setGeneratedResult} />
        <GeneratedResult result={generatedResult} />
      </div>
    </main>
  );
}
