"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy } from "lucide-react";

import type { GenerationSnapshotData } from "@/src/lib/generation-snapshot";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { useToast } from "@/src/hooks/use-toast";

interface GenerationSnapshotViewProps {
  snapshot: GenerationSnapshotData | null;
  editableProposal?: boolean;
  detailHref?: string | null;
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function GenerationSnapshotView({
  snapshot,
  editableProposal = false,
  detailHref
}: GenerationSnapshotViewProps) {
  const { toast } = useToast();
  const [proposalText, setProposalText] = useState("");

  useEffect(() => {
    setProposalText(snapshot?.finalProposal ?? "");
  }, [snapshot?.finalProposal]);

  async function onCopy() {
    if (!proposalText.trim()) {
      toast({
        title: "Nothing to copy",
        description: "Generate or open a proposal first.",
        variant: "destructive"
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(proposalText);
      toast({
        title: "Copied",
        description: "Proposal copied to clipboard."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clipboard is unavailable.";
      toast({
        title: "Copy failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Generated Proposal</CardTitle>
              <CardDescription>
                {snapshot
                  ? `Saved run for ${snapshot.candidateSnapshot.displayName} on ${formatTimestamp(snapshot.createdAt)}.`
                  : "Grounded output with plan, evidence, and evaluator trace."}
              </CardDescription>
            </div>
            {snapshot ? (
              <Badge variant={snapshot.approvalStatus === "APPROVED" ? "default" : "outline"}>
                {snapshot.approvalStatus}
              </Badge>
            ) : (
              <Badge variant="outline">Awaiting generation</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={proposalText}
            onChange={(event) => setProposalText(event.target.value)}
            rows={16}
            readOnly={!editableProposal}
            placeholder="Your grounded proposal will appear here..."
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={onCopy}>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </Button>
              {snapshot && detailHref ? (
                <Button asChild type="button" variant="outline">
                  <Link href={detailHref}>Open Saved Run</Link>
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {snapshot
                ? `Trace: ${
                    snapshot.executionTrace.length > 0
                      ? snapshot.executionTrace.join(" -> ")
                      : "Unavailable for this run"
                  } • ${snapshot.telemetrySummary.totalTokens} tokens • ${formatDuration(snapshot.telemetrySummary.totalDurationMs)}`
                : "Run generation to see the full trace."}
            </p>
          </div>
        </CardContent>
      </Card>

      {snapshot ? (
        <>
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Job Understanding</CardTitle>
              <CardDescription>{snapshot.jobUnderstanding.jobSummary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MiniList title="Client Needs" items={snapshot.jobUnderstanding.clientNeeds} />
              <MiniList title="Must-Have Skills" items={snapshot.jobUnderstanding.mustHaveSkills} />
              <MiniList title="Nice-to-Have Skills" items={snapshot.jobUnderstanding.niceToHaveSkills} />
              <MiniList title="Risk Flags" items={snapshot.jobUnderstanding.projectRiskFlags} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Selected Evidence</CardTitle>
              <CardDescription>These are the only factual blocks the writer was allowed to cite.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.selectedEvidence.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{item.type}</Badge>
                    <span className="text-xs text-muted-foreground">{item.reason}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Proposal Plan</CardTitle>
              <CardDescription>{snapshot.proposalPlan.openingAngle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MiniList title="Main Points" items={snapshot.proposalPlan.mainPoints} />
              <MiniList title="Avoid" items={snapshot.proposalPlan.avoid} />
              <p className="text-sm text-muted-foreground">CTA style: {snapshot.proposalPlan.ctaStyle}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Retrieved Signals</CardTitle>
              <CardDescription>Canonical cases, fragments, and evidence candidates used during retrieval.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Similar Cases</p>
                {snapshot.retrievedContext.similarCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Snapshot unavailable for this run.</p>
                ) : (
                  snapshot.retrievedContext.similarCases.map((item) => (
                    <div key={item._id} className="rounded-lg border p-3">
                      <p className="font-medium">{item.jobTitle}</p>
                      <p className="text-sm text-muted-foreground">{item.jobExtract.summary}</p>
                    </div>
                  ))
                )}
              </div>
              <MiniList
                title="Openings"
                items={snapshot.retrievedContext.fragments.openings.map((item) => item.text)}
              />
              <MiniList
                title="Proof Fragments"
                items={snapshot.retrievedContext.fragments.proofs.map((item) => item.text)}
              />
              <MiniList
                title="Closings"
                items={snapshot.retrievedContext.fragments.closings.map((item) => item.text)}
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">Evidence Candidates</p>
                {snapshot.retrievedContext.evidenceCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved evidence-candidate snapshot.</p>
                ) : (
                  snapshot.retrievedContext.evidenceCandidates.map((item) => (
                    <div key={item._id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{item.type}</Badge>
                        <Badge variant="outline">{item.source}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Evaluator</CardTitle>
              <CardDescription>
                {snapshot.copyRisk.triggered ? "Copy-risk signal triggered." : "No deterministic copy-risk trigger."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {snapshot.critiqueHistory.map((critique, index) => (
                <div key={`critique-${index}`} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={critique.approvalStatus === "APPROVED" ? "default" : "outline"}>
                      Pass {index + 1}: {critique.approvalStatus}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Relevance {critique.rubric.relevance} / Specificity {critique.rubric.specificity}
                    </span>
                  </div>
                  <MiniList title="Issues" items={critique.issues} />
                  <MiniList title="Revision Instructions" items={critique.revisionInstructions} />
                </div>
              ))}
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Max paragraph cosine: {snapshot.copyRisk.maxParagraphCosine.toFixed(2)}. Trigram overlap:{" "}
                {snapshot.copyRisk.trigramOverlap.toFixed(2)}.
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Execution Trace</CardTitle>
              <CardDescription>Graph stages executed for this saved run.</CardDescription>
            </CardHeader>
            <CardContent>
              {snapshot.executionTrace.length === 0 ? (
                <p className="text-sm text-muted-foreground">Execution trace snapshot unavailable for this run.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {snapshot.executionTrace.map((step) => (
                    <Badge key={step} variant="outline">
                      {step}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Telemetry</CardTitle>
              <CardDescription>Exact per-step timing and token usage captured for this run.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Steps</p>
                  <p className="mt-2 text-xl font-semibold">{snapshot.telemetrySummary.totalSteps}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Duration</p>
                  <p className="mt-2 text-xl font-semibold">{formatDuration(snapshot.telemetrySummary.totalDurationMs)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Input / Output Tokens</p>
                  <p className="mt-2 text-xl font-semibold">
                    {snapshot.telemetrySummary.totalInputTokens} / {snapshot.telemetrySummary.totalOutputTokens}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Tokens</p>
                  <p className="mt-2 text-xl font-semibold">{snapshot.telemetrySummary.totalTokens}</p>
                </div>
              </div>

              {snapshot.stepTelemetry.length === 0 ? (
                <p className="text-sm text-muted-foreground">Telemetry snapshot unavailable for this run.</p>
              ) : (
                <div className="space-y-3">
                  {snapshot.stepTelemetry.map((step, index) => (
                    <div
                      key={`${step.step}-${step.fragmentType ?? "base"}-${step.attempt ?? 0}-${index}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{step.stage}</Badge>
                        <Badge variant="outline">{step.kind}</Badge>
                        {step.fragmentType ? <Badge variant="secondary">{step.fragmentType}</Badge> : null}
                        {typeof step.attempt === "number" ? (
                          <Badge variant="outline">Attempt {step.attempt}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {step.step} • {formatDuration(step.durationMs)}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <div>Model: {step.model ?? "n/a"}</div>
                        <div>Started: {formatTimestamp(step.startedAt)}</div>
                        <div>Results: {typeof step.resultCount === "number" ? step.resultCount : "n/a"}</div>
                        <div>Limit: {typeof step.limit === "number" ? step.limit : "n/a"}</div>
                        <div>Input tokens: {step.tokenUsage?.inputTokens ?? 0}</div>
                        <div>Output tokens: {step.tokenUsage?.outputTokens ?? 0}</div>
                        <div>Total tokens: {step.tokenUsage?.totalTokens ?? 0}</div>
                        <div>Reasoning tokens: {step.tokenUsage?.reasoningTokens ?? 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
