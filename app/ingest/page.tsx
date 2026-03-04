"use client";

import { useState } from "react";

import { IngestionForm } from "@/components/ingestion-form";
import { ExtractionResults, type ExtractionResultsData } from "@/components/extraction-results";
import { Separator } from "@/components/ui/separator";

/**
 * Phase 1: Knowledge Ingestion page.
 *
 * Provides the IngestionForm to submit historical job-proposal-member data
 * and displays ExtractionResults (tech stack + style profile) after
 * successful ingestion.
 */
export default function IngestPage() {
    const [results, setResults] = useState<ExtractionResultsData | null>(null);

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                        R
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">
                            Phase 1: Knowledge Ingestion
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Submit historical job-proposal pairs to build your writing profile
                        </p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
                <IngestionForm onSuccess={setResults} />

                {results && (
                    <>
                        <Separator />
                        <ExtractionResults data={results} />
                    </>
                )}
            </div>
        </main>
    );
}
