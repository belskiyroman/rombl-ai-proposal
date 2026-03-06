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
    <Card className="border-0 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Generated Proposal</CardTitle>
            <CardDescription>Edit the result before submitting it to the client.</CardDescription>
          </div>
          {result ? (
            <Badge variant={result.criticStatus === "APPROVED" ? "default" : "outline"}>
              Critic: {result.criticStatus}
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
          placeholder="Your generated proposal will appear here..."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={onCopy}>
            <Copy className="h-4 w-4" />
            Copy to Clipboard
          </Button>
          {result?.executionTrace?.length ? (
            <p className="text-xs text-muted-foreground">
              Trace: {result.executionTrace.join(" -> ")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Run generation to see execution trace.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
