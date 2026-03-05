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
import { Skeleton } from "@/src/components/ui/skeleton";
import { Textarea } from "@/src/components/ui/textarea";
import { useToast } from "@/src/hooks/use-toast";

const generationFormSchema = z.object({
  memberId: z.number().int().positive().optional(),
  newJobDescription: z
    .string()
    .trim()
    .min(30, "Paste a detailed job description (minimum 30 characters).")
});

type GenerationFormValues = z.infer<typeof generationFormSchema>;

export interface GeneratedProposalData {
  finalProposal: string;
  criticStatus: "APPROVED" | "NEEDS_REVISION";
  critiquePoints?: string[];
  executionTrace: string[];
}

interface GenerationFormProps {
  contextId?: number | null;
  onGenerated: (result: GeneratedProposalData) => void;
}

const defaultValues: GenerationFormValues = {
  memberId: undefined,
  newJobDescription: ""
};

export function GenerationForm({ contextId, onGenerated }: GenerationFormProps) {
  const { toast } = useToast();
  const createProposal = useAction(api.generate.createProposal);
  const members = useQuery(api.members.listMembers) ?? [];

  const form = useForm<GenerationFormValues>({
    resolver: zodResolver(generationFormSchema),
    defaultValues
  });

  const isSubmitting = form.formState.isSubmitting;
  const selectedMemberId = form.watch("memberId");

  async function onSubmit(values: GenerationFormValues) {
    try {
      const generated = await createProposal({
        newJobDescription: values.newJobDescription,
        preferredMemberId: values.memberId
      });

      onGenerated({
        finalProposal: generated.finalProposal,
        criticStatus: generated.criticStatus,
        critiquePoints: generated.critiquePoints,
        executionTrace: generated.executionTrace
      });

      toast({
        title: "Proposal generated",
        description:
          generated.criticStatus === "APPROVED"
            ? "Draft approved by the critic agent."
            : "Draft returned with revision notes."
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
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Generate New Proposal</CardTitle>
            <CardDescription className="mt-1">
              Paste a new job description to run Retrieval, Writer, and Critic agents.
            </CardDescription>
          </div>
          {contextId ? (
            <Badge className="text-xs sm:text-sm">Context Locked: Job #{contextId}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs sm:text-sm">
              Context: Auto retrieval
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="memberId"
              render={() => (
                <FormItem>
                  <FormLabel>Profile</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedMemberId ? "outline" : "default"}
                          onClick={() => form.setValue("memberId", undefined, { shouldDirty: true })}
                        >
                          Auto (Latest)
                        </Button>
                        {members.map((member) => (
                          <Button
                            key={member.memberId}
                            type="button"
                            size="sm"
                            variant={selectedMemberId === member.memberId ? "default" : "outline"}
                            onClick={() => form.setValue("memberId", member.memberId, { shouldDirty: true })}
                          >
                            {member.memberName || `#${member.memberId}`}
                            {member.memberLocation ? ` (${member.memberLocation})` : ""}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Choose who this proposal should sound like. Auto uses the latest ingested profile.
                      </p>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newJobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Job Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={14}
                      placeholder="Paste the full client job post, requirements, and constraints..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="min-w-44">
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

        {isSubmitting ? (
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Agents are working</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Retrieving Context -&gt; Drafting -&gt; Reviewing...
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Skeleton className="h-2 w-24" />
                <span>Retrieving Context</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Skeleton className="h-2 w-24" />
                <span>Drafting</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Skeleton className="h-2 w-24" />
                <span>Reviewing</span>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
