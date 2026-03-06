"use client";

import { use, useMemo, useState } from "react";

import { GenerationForm, type GeneratedProposalData } from "@/src/components/GenerationForm";
import { GeneratedResult } from "@/src/components/GeneratedResult";

type GenerateSearchParams = {
  contextId?: string | string[];
};

interface GeneratePageProps {
  searchParams?: Promise<GenerateSearchParams>;
}

export default function GeneratePage({ searchParams }: GeneratePageProps) {
  const resolvedSearchParams = use<GenerateSearchParams>(searchParams ?? Promise.resolve({}));
  const contextIdValue = Array.isArray(resolvedSearchParams.contextId)
    ? resolvedSearchParams.contextId[0]
    : resolvedSearchParams.contextId;
  const [generatedResult, setGeneratedResult] = useState<GeneratedProposalData | null>(null);

  const contextId = useMemo(() => {
    if (!contextIdValue) {
      return null;
    }

    const parsed = Number(contextIdValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [contextIdValue]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a proposal from a new job description using your ingested knowledge base.
          </p>
        </div>

        <GenerationForm contextId={contextId} onGenerated={setGeneratedResult} />
        <GeneratedResult result={generatedResult} />
      </div>
    </main>
  );
}
