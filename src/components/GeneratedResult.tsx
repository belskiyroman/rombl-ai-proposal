"use client";

import type { GenerationSnapshotData } from "@/src/lib/generation-snapshot";
import { GenerationSnapshotView } from "@/src/components/GenerationSnapshotView";

interface GeneratedResultProps {
  result: GenerationSnapshotData | null;
}

export function GeneratedResult({ result }: GeneratedResultProps) {
  return (
    <GenerationSnapshotView
      snapshot={result}
      editableProposal
      detailHref={result ? `/generate/history/${result.generationRunId}` : null}
    />
  );
}

