"use client";

import { useState } from "react";

import { ExtractionResults, type ExtractionResultsData } from "@/src/components/ExtractionResults";
import { IngestionForm } from "@/src/components/IngestionForm";

/**
 * V2 ingestion console for candidate profile, evidence, historical cases,
 * and V1 backfill into the structured proposal engine.
 */
export default function IngestPage() {
    const [results, setResults] = useState<ExtractionResultsData | null>(null);

    return (
        <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* Header */}
            <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                        R
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">
                            Structured Proposal Engine V2
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Build candidate profile memory, evidence blocks, and canonical case-library artifacts
                        </p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-6xl px-6 py-8 space-y-8 animate-fade-in">
                <IngestionForm onSuccess={setResults} />

                {results && (
                    <>
                        <div className="h-px w-full bg-border/60" />
                        <ExtractionResults data={results} />
                    </>
                )}
            </div>
        </main>
    );
}
