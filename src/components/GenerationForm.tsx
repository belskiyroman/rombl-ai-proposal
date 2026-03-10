"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { Textarea } from "@/src/components/ui/textarea";
import { Input } from "@/src/components/ui/input";
import { useToast } from "@/src/hooks/use-toast";

const generationFormSchema = z.object({
  candidateId: z.coerce.number().int().positive("Candidate ID is required"),
  title: z.string().trim().optional(),
  description: z.string().trim().min(40, "Paste a more detailed client job description")
});

type GenerationFormValues = z.infer<typeof generationFormSchema>;

interface CandidateProfileOption {
  _id: string;
  candidateId: number;
  displayName: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
  updatedAt: number;
}

export interface GeneratedProposalData {
  generationRunId: string;
  finalProposal: string;
  approvalStatus: "APPROVED" | "NEEDS_REVISION";
  critiqueHistory: Array<{
    issues: string[];
    revisionInstructions: string[];
    approvalStatus: "APPROVED" | "NEEDS_REVISION";
    rubric: {
      relevance: number;
      specificity: number;
      credibility: number;
      tone: number;
      clarity: number;
      ctaStrength: number;
    };
    copyRisk: {
      triggered: boolean;
      maxParagraphCosine: number;
      trigramOverlap: number;
      reasons: string[];
    };
  }>;
  executionTrace: string[];
  selectedEvidence: Array<{
    id: string;
    reason: string;
    text: string;
    type: string;
  }>;
  retrievedContext: {
    similarCases: Array<{
      _id: string;
      jobTitle: string;
      jobExtract: { summary: string };
      proposalExtract: { hook: string; tone: string };
      finalScore?: number;
    }>;
    fragments: {
      openings: Array<{ _id: string; text: string }>;
      proofs: Array<{ _id: string; text: string }>;
      closings: Array<{ _id: string; text: string }>;
    };
    evidenceCandidates: Array<{ _id: string; text: string; type: string }>;
  };
  jobUnderstanding: {
    jobSummary: string;
    clientNeeds: string[];
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    projectRiskFlags: string[];
    proposalStrategy: {
      tone: string;
      length: string;
      focus: string[];
    };
  };
  proposalPlan: {
    openingAngle: string;
    mainPoints: string[];
    selectedEvidenceIds: string[];
    selectedFragmentIds: string[];
    avoid: string[];
    ctaStyle: string;
  };
  draftHistory: string[];
  copyRisk: {
    triggered: boolean;
    maxParagraphCosine: number;
    trigramOverlap: number;
    reasons: string[];
  } | null;
}

interface GenerationFormProps {
  onGenerated: (result: GeneratedProposalData) => void;
}

const defaultValues: GenerationFormValues = {
  candidateId: 1,
  title: "",
  description: ""
};

export function GenerationForm({ onGenerated }: GenerationFormProps) {
  const { toast } = useToast();
  const createProposalV2 = useAction(api.generate.createProposalV2);
  const candidates = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];

  const form = useForm<GenerationFormValues>({
    resolver: zodResolver(generationFormSchema),
    defaultValues
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: GenerationFormValues) {
    try {
      const generated = await createProposalV2({
        candidateId: values.candidateId,
        jobInput: {
          title: values.title || undefined,
          description: values.description
        }
      });

      onGenerated(generated);
      toast({
        title: "Proposal generated",
        description:
          generated.approvalStatus === "APPROVED"
            ? "Draft passed the evaluator and is ready for review."
            : "Draft generated with revision notes attached."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation error";
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-xl">Generate Proposal V2</CardTitle>
          <CardDescription>
            Run job understanding, structured retrieval, evidence selection, planning, generation, and critique.
          </CardDescription>
        </div>
        {candidates.length === 0 ? (
          <Badge variant="outline">Create a candidate profile first</Badge>
        ) : (
          <div className="flex flex-wrap gap-2">
            {candidates.map((candidate) => (
              <Button
                key={candidate._id}
                type="button"
                size="sm"
                variant={form.watch("candidateId") === candidate.candidateId ? "default" : "outline"}
                onClick={() => form.setValue("candidateId", candidate.candidateId, { shouldDirty: true })}
              >
                {candidate.displayName} #{candidate.candidateId}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="candidateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Candidate ID</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Optional, but useful for extraction quality" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={14}
                      placeholder="Paste the full client job post, requirements, constraints, and soft signals..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting || candidates.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Proposal"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
