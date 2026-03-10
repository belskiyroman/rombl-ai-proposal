"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useAction } from "convex/react";
import { useForm } from "react-hook-form";
import type { Id } from "@/convex/_generated/dataModel";

import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/src/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { useToast } from "@/src/hooks/use-toast";
import { historicalCaseFormSchema, type HistoricalCaseFormValues } from "@/lib/schemas/ingestion-form-schema";

export interface EditableHistoricalCase {
  _id: string;
  candidateId: number;
  jobTitle: string;
  rawJobDescription: string;
  rawProposalText: string;
  outcome?: {
    reply?: boolean;
    interview?: boolean;
    hired?: boolean;
  };
}

interface LibraryCaseEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: number | null;
  caseRecord?: EditableHistoricalCase | null;
  onSaved: (historicalCaseId: string) => void;
}

function createDefaults(candidateId: number | null, caseRecord?: EditableHistoricalCase | null): HistoricalCaseFormValues {
  return {
    candidateId: caseRecord?.candidateId ?? candidateId ?? 1,
    jobTitle: caseRecord?.jobTitle ?? "",
    jobDescription: caseRecord?.rawJobDescription ?? "",
    proposalText: caseRecord?.rawProposalText ?? "",
    reply: Boolean(caseRecord?.outcome?.reply),
    interview: Boolean(caseRecord?.outcome?.interview),
    hired: Boolean(caseRecord?.outcome?.hired)
  };
}

export function LibraryCaseEditorDialog({
  open,
  onOpenChange,
  candidateId,
  caseRecord,
  onSaved
}: LibraryCaseEditorDialogProps) {
  const { toast } = useToast();
  const ingestHistoricalCase = useAction(api.cases.ingestHistoricalCase);
  const updateHistoricalCase = useAction(api.cases.updateHistoricalCase);

  const form = useForm<HistoricalCaseFormValues>({
    resolver: zodResolver(historicalCaseFormSchema),
    defaultValues: createDefaults(candidateId, caseRecord)
  });

  useEffect(() => {
    form.reset(createDefaults(candidateId, caseRecord));
  }, [candidateId, caseRecord, form, open]);

  const isSubmitting = form.formState.isSubmitting;
  const isEditing = Boolean(caseRecord);

  async function onSubmit(values: HistoricalCaseFormValues) {
    try {
      if (isEditing && caseRecord) {
        const result = await updateHistoricalCase({
          historicalCaseId: caseRecord._id as Id<"historical_cases">,
          jobTitle: values.jobTitle,
          jobDescription: values.jobDescription,
          proposalText: values.proposalText,
          outcome: {
            reply: values.reply,
            interview: values.interview,
            hired: values.hired
          }
        });

        toast({
          title: "Historical case updated",
          description: "The case was reprocessed and the library cluster state was refreshed."
        });
        onSaved(result.historicalCaseId);
        onOpenChange(false);
        return;
      }

      if (candidateId === null) {
        throw new Error("Select a candidate before creating a historical case.");
      }

      const result = await ingestHistoricalCase({
        candidateId,
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalText: values.proposalText,
        outcome: {
          reply: values.reply,
          interview: values.interview,
          hired: values.hired
        }
      });

      toast({
        title: "Historical case created",
        description: result.canonical
          ? "The new case became a canonical representative."
          : "The new case was added as a cluster variant."
      });
      onSaved(result.historicalCaseId);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown library save error";
      toast({
        title: isEditing ? "Case update failed" : "Case creation failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Historical Case" : "Create Historical Case"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the source text and outcomes. The case will be reprocessed and reclustered."
              : "Add a new library case for the selected candidate."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="candidateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate ID</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="proposalText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposal Text</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap gap-2">
              {(["reply", "interview", "hired"] as const).map((fieldName) => (
                <Button
                  key={fieldName}
                  type="button"
                  size="sm"
                  variant={form.watch(fieldName) ? "default" : "outline"}
                  onClick={() =>
                    form.setValue(fieldName, !form.watch(fieldName), {
                      shouldDirty: true,
                      shouldValidate: true
                    })
                  }
                >
                  {fieldName}
                </Button>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEditing ? "Save Changes" : "Create Case"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
