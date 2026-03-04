"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ---------- Types ----------

export interface WritingStyleAnalysis {
    formality: number;
    enthusiasm: number;
    keyVocabulary: string[];
    sentenceStructure: string;
}

export interface ExtractionResultsData {
    rawJobId: string;
    styleProfileId: string;
    processedProposalId: string;
    executionTrace: string[];
    /** Optional — populated when the style profile is fetched after ingestion */
    writingStyleAnalysis?: WritingStyleAnalysis;
    techStack?: string[];
}

interface ExtractionResultsProps {
    data: ExtractionResultsData;
}

// ---------- Sub-components ----------

/** Visual bar for a 1–10 score. */
function ScoreBar({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
    const pct = Math.round((score / max) * 100);

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                    {score}/{max}
                </span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

// ---------- Main Component ----------

export function ExtractionResults({ data }: ExtractionResultsProps) {
    const { techStack, writingStyleAnalysis, executionTrace, rawJobId, styleProfileId, processedProposalId } = data;

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold tracking-tight">Extraction Results</h2>

            {/* IDs summary */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Created Records</CardTitle>
                    <CardDescription>IDs of the documents stored in the database</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                            <span className="text-muted-foreground">Raw Job:</span>{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{rawJobId}</code>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Style Profile:</span>{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{styleProfileId}</code>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Processed Proposal:</span>{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{processedProposalId}</code>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tech Stack */}
            {techStack && techStack.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Extracted Tech Stack</CardTitle>
                        <CardDescription>
                            Technologies identified by the Agent-Analyzer from the job description
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {techStack.map((tech) => (
                                <Badge key={tech} variant="secondary" className="text-sm">
                                    {tech}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Writing Style Analysis */}
            {writingStyleAnalysis && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Writing Style Analysis</CardTitle>
                        <CardDescription>
                            Style profile extracted from your proposal — verify these match your writing persona
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Score bars */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <ScoreBar label="Formality" score={writingStyleAnalysis.formality} />
                            <ScoreBar label="Enthusiasm" score={writingStyleAnalysis.enthusiasm} />
                        </div>

                        <Separator />

                        {/* Key Vocabulary */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground">Key Vocabulary</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {writingStyleAnalysis.keyVocabulary.map((word) => (
                                    <Badge key={word} variant="outline" className="text-xs">
                                        {word}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Sentence Structure */}
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-foreground">Sentence Structure</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {writingStyleAnalysis.sentenceStructure}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Execution Trace */}
            {executionTrace.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Execution Trace</CardTitle>
                        <CardDescription>
                            Processing steps completed by the ingestion pipeline
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                            {executionTrace.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
