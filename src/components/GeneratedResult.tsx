"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";

import type { GeneratedProposalData } from "@/src/components/GenerationForm";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Textarea } from "@/src/components/ui/textarea";
import { useToast } from "@/src/hooks/use-toast";

interface GeneratedResultProps {
  result: GeneratedProposalData | null;
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

export function GeneratedResult({ result }: GeneratedResultProps) {
  const { toast } = useToast();
  const [proposalText, setProposalText] = useState("");

  useEffect(() => {
    setProposalText(result?.finalProposal ?? "");
  }, [result?.finalProposal]);

  async function onCopy() {
    if (!proposalText.trim()) {
      toast({
        title: "Nothing to copy",
        description: "Generate a proposal first.",
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
              <CardDescription>Grounded V2 output with plan, evidence, and evaluator trace.</CardDescription>
            </div>
            {result ? (
              <Badge variant={result.approvalStatus === "APPROVED" ? "default" : "outline"}>
                {result.approvalStatus}
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
            placeholder="Your grounded proposal will appear here..."
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" onClick={onCopy}>
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </Button>
            <p className="text-xs text-muted-foreground">
              {result ? `Trace: ${result.executionTrace.join(" -> ")}` : "Run generation to see the full trace."}
            </p>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Job Understanding</CardTitle>
              <CardDescription>{result.jobUnderstanding.jobSummary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MiniList title="Client Needs" items={result.jobUnderstanding.clientNeeds} />
              <MiniList title="Must-Have Skills" items={result.jobUnderstanding.mustHaveSkills} />
              <MiniList title="Nice-to-Have Skills" items={result.jobUnderstanding.niceToHaveSkills} />
              <MiniList title="Risk Flags" items={result.jobUnderstanding.projectRiskFlags} />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Selected Evidence</CardTitle>
              <CardDescription>These are the only factual blocks the writer was allowed to cite.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.selectedEvidence.map((item) => (
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
              <CardDescription>{result.proposalPlan.openingAngle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MiniList title="Main Points" items={result.proposalPlan.mainPoints} />
              <MiniList title="Avoid" items={result.proposalPlan.avoid} />
              <p className="text-sm text-muted-foreground">CTA style: {result.proposalPlan.ctaStyle}</p>
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
                {result.retrievedContext.similarCases.map((item) => (
                  <div key={item._id} className="rounded-lg border p-3">
                    <p className="font-medium">{item.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">{item.jobExtract.summary}</p>
                  </div>
                ))}
              </div>
              <MiniList
                title="Openings"
                items={result.retrievedContext.fragments.openings.map((item) => item.text)}
              />
              <MiniList
                title="Proof Fragments"
                items={result.retrievedContext.fragments.proofs.map((item) => item.text)}
              />
              <MiniList
                title="Closings"
                items={result.retrievedContext.fragments.closings.map((item) => item.text)}
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Evaluator</CardTitle>
              <CardDescription>
                {result.copyRisk?.triggered ? "Copy-risk signal triggered." : "No deterministic copy-risk trigger."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.critiqueHistory.map((critique, index) => (
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
              {result.copyRisk ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Max paragraph cosine: {result.copyRisk.maxParagraphCosine.toFixed(2)}. Trigram overlap:{" "}
                  {result.copyRisk.trigramOverlap.toFixed(2)}.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
