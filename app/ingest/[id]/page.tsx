"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { IngestViewForm } from "@/src/components/IngestViewForm";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";

export default function IngestViewPage() {
    const params = useParams();
    const id = params.id as Id<"processed_proposals">;

    const pair = useQuery(api.jobs.getPairDetail, { id });

    return (
        <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* Header */}
            <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                            R
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">
                                Knowledge Base Item View
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Previously ingested job-proposal pair details
                            </p>
                        </div>
                    </div>
                    <Link href="/pairs">
                        <Button variant="outline" size="sm">Back to Pairs</Button>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-6xl px-6 py-8 space-y-8 animate-fade-in">
                {pair === undefined ? (
                    <div className="flex h-64 items-center justify-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p>Loading pair details...</p>
                        </div>
                    </div>
                ) : pair === null ? (
                    <div className="rounded-lg border border-dashed p-8 text-center bg-card">
                        <p className="font-medium text-destructive">Pair not found.</p>
                        <p className="mt-1 text-sm text-muted-foreground">This pair may have been deleted.</p>
                        <Link href="/pairs" className="mt-4 inline-block">
                            <Button variant="outline">Back to Pairs</Button>
                        </Link>
                    </div>
                ) : (
                    <IngestViewForm pair={pair} />
                )}
            </div>
        </main>
    );
}
