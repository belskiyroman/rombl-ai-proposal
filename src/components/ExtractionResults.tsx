"use client";

import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

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
  writingStyleAnalysis?: WritingStyleAnalysis;
  techStack?: string[];
}

interface ExtractionResultsProps {
  data: ExtractionResultsData;
}

function ScoreBar({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((score / max) * 100)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {score}/{max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary">
        <div className={cn("h-full rounded-full bg-primary transition-all duration-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ExtractionResults({ data }: ExtractionResultsProps) {
  const { techStack, writingStyleAnalysis, executionTrace, rawJobId, styleProfileId, processedProposalId } = data;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold tracking-tight">Extraction Results</h2>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Created Records</CardTitle>
          <CardDescription>IDs of documents stored by the ingestion workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Raw Job:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{rawJobId}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Style Profile:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{styleProfileId}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Processed Proposal:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{processedProposalId}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {techStack && techStack.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Extracted Tech Stack</CardTitle>
            <CardDescription>Technologies identified by the Analyzer</CardDescription>
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
      ) : null}

      {writingStyleAnalysis ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Writing Style Analysis</CardTitle>
            <CardDescription>Tone and structure extracted from the proposal text</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ScoreBar label="Formality" score={writingStyleAnalysis.formality} />
              <ScoreBar label="Enthusiasm" score={writingStyleAnalysis.enthusiasm} />
            </div>

            <div className="h-px w-full bg-border" />

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

            <div className="h-px w-full bg-border" />

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-foreground">Sentence Structure</h4>
              <p className="text-sm leading-relaxed text-muted-foreground">{writingStyleAnalysis.sentenceStructure}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {executionTrace.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Execution Trace</CardTitle>
            <CardDescription>Ingestion pipeline steps completed</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              {executionTrace.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
