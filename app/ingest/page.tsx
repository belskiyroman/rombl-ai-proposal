"use client";

import { useState } from "react";

import { ExtractionResults, type ExtractionResultsData } from "@/src/components/ExtractionResults";
import { IngestionForm } from "@/src/components/IngestionForm";

export default function IngestPage() {
    const [results, setResults] = useState<ExtractionResultsData | null>(null);

    return (
        <main className="min-h-[calc(100vh-52px)]">
            <div className="mx-auto max-w-7xl px-6 py-8 space-y-8 animate-fade-in">
                <IngestionForm onSuccess={setResults} />

                {results && (
                    <>
                        <div className="h-px w-full bg-white/[0.06]" />
                        <ExtractionResults data={results} />
                    </>
                )}
            </div>
        </main>
    );
}
