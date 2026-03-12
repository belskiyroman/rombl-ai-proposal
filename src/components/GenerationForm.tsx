"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { GenerationProgressData } from "@/src/lib/generation-progress";
import type { GenerationSnapshotData } from "@/src/lib/generation-snapshot";
import { GenerationProgressCard } from "@/src/components/GenerationProgressCard";
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

interface GenerationFormProps {
  onGenerated: (result: GenerationSnapshotData | null) => void;
}

const defaultValues: GenerationFormValues = {
  candidateId: 1,
  title: "",
  description: ""
};

export function GenerationForm({ onGenerated }: GenerationFormProps) {
  const { toast } = useToast();
  const createGenerationProgress = useMutation(api.generate.createGenerationProgress);
  const createProposal = useAction(api.generate.createProposal);
  const candidates = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];
  const [activeProgressId, setActiveProgressId] = useState<Id<"generation_progress"> | null>(null);
  const progress = useQuery(
    api.generate.getGenerationProgress,
    activeProgressId ? { id: activeProgressId } : "skip"
  ) as GenerationProgressData | null | undefined;

  const form = useForm<GenerationFormValues>({
    resolver: zodResolver(generationFormSchema),
    defaultValues
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: GenerationFormValues) {
    try {
      onGenerated(null);
      const progressId = await createGenerationProgress({
        candidateId: values.candidateId,
        jobInput: {
          title: values.title || undefined,
          description: values.description
        }
      });
      setActiveProgressId(progressId as Id<"generation_progress">);

      const generated = await createProposal({
        candidateId: values.candidateId,
        jobInput: {
          title: values.title || undefined,
          description: values.description
        },
        progressId: progressId as Id<"generation_progress">
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="text-xl">Generate Proposal</CardTitle>
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

              <Button type="submit" disabled={isSubmitting || candidates.length === 0} className="w-full sm:w-auto">
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

      <GenerationProgressCard progress={progress} />
    </div>
  );
}
