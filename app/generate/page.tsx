"use client";

import { useState } from "react";

import { GenerationForm, type GeneratedProposalData } from "@/src/components/GenerationForm";
import { GeneratedResult } from "@/src/components/GeneratedResult";

export default function GeneratePage() {
  const [generatedResult, setGeneratedResult] = useState<GeneratedProposalData | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grounded Generator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a proposal from structured job understanding, candidate evidence, canonical cases, and curated fragments.
          </p>
        </div>

        <GenerationForm onGenerated={setGeneratedResult} />
        <GeneratedResult result={generatedResult} />
      </div>
    </main>
  );
}
