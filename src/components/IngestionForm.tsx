"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useAction } from "convex/react";
import { useForm } from "react-hook-form";

import { api } from "@/convex/_generated/api";
import type { ExtractionResultsData } from "@/src/components/ExtractionResults";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { useToast } from "@/src/hooks/use-toast";
import { cn } from "@/src/lib/utils";
import {
  ingestionFormSchema,
  pasteJsonSchema,
  type IngestionFormValues,
  type PasteJsonValues
} from "@/lib/schemas/ingestion-form-schema";

interface IngestionFormProps {
  onSuccess: (data: ExtractionResultsData) => void;
}

const defaultValues: IngestionFormValues = {
  job: {
    id: 0,
    clientLocation: "",
    clientReview: 0,
    clientReviewAmount: 0,
    clientTotalSpent: 0,
    type: "fixedPrice",
    skills: [],
    title: "",
    text: ""
  },
  proposal: {
    id: 0,
    jobId: 0,
    viewed: false,
    interview: false,
    offer: false,
    price: "",
    agency: false,
    memberId: 0,
    text: ""
  },
  member: {
    id: 0,
    name: "",
    agency: false,
    agencyName: "",
    talentBadge: "",
    jss: 0,
    location: ""
  }
};

const projectTypes: Array<{ value: IngestionFormValues["job"]["type"]; label: string }> = [
  { value: "hourly", label: "Hourly" },
  { value: "fixedPrice", label: "Fixed Price" },
  { value: "hourly/fixedPrice", label: "Hourly / Fixed Price" }
];

function BooleanBadgeField({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="inline-flex items-center gap-1.5">
      <Badge variant={value ? "default" : "secondary"} className="cursor-pointer select-none">
        {label}: {value ? "Yes" : "No"}
      </Badge>
    </button>
  );
}

export function IngestionForm({ onSuccess }: IngestionFormProps) {
  const [mode, setMode] = useState<"form" | "json">("form");
  const [skillInput, setSkillInput] = useState("");

  const { toast } = useToast();
  const ingestAction = useAction(api.jobs.ingestJobProposalPair);

  const form = useForm<IngestionFormValues>({
    resolver: zodResolver(ingestionFormSchema),
    defaultValues
  });

  const jsonForm = useForm<PasteJsonValues>({
    resolver: zodResolver(pasteJsonSchema),
    defaultValues: { rawJson: "" }
  });

  const skills = form.watch("job.skills");
  const isAgencyMember = form.watch("member.agency");

  function addSkill() {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.includes(trimmed)) {
      return;
    }

    form.setValue("job.skills", [...skills, trimmed], {
      shouldDirty: true,
      shouldValidate: true
    });
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    form.setValue(
      "job.skills",
      skills.filter((item) => item !== skill),
      { shouldDirty: true, shouldValidate: true }
    );
  }

  async function onFormSubmit(values: IngestionFormValues) {
    try {
      const result = await ingestAction({
        source: "manual",
        job: values.job,
        proposal: values.proposal,
        member: values.member
      });

      toast({
        title: "Ingestion successful",
        description: "Created raw job, style profile, and processed proposal records."
      });

      onSuccess({
        rawJobId: result.rawJobId,
        styleProfileId: result.styleProfileId,
        processedProposalId: result.processedProposalId,
        executionTrace: result.executionTrace
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Ingestion failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  async function onJsonSubmit(values: PasteJsonValues) {
    try {
      const parsed = JSON.parse(values.rawJson);
      const validated = ingestionFormSchema.parse(parsed);

      form.reset(validated);
      setMode("form");

      toast({
        title: "JSON parsed successfully",
        description: "Review loaded fields and submit ingestion."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON payload";
      toast({
        title: "JSON parse error",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Ingest Job-Proposal Pair</CardTitle>
            <CardDescription className="mt-1">
              Submit historical Job, Proposal, and Member data to build retrieval and style profile memory.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "form" ? "default" : "outline"} onClick={() => setMode("form")}>
              Form
            </Button>
            <Button type="button" size="sm" variant={mode === "json" ? "default" : "outline"} onClick={() => setMode("json")}>
              Paste JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "json" ? (
          <Form {...jsonForm}>
            <form onSubmit={jsonForm.handleSubmit(onJsonSubmit)} className="space-y-4">
              <FormField
                control={jsonForm.control}
                name="rawJson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paste full JSON payload</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={16}
                        placeholder={'{\n  "job": { ... },\n  "proposal": { ... },\n  "member": { ... }\n}'}
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Parse & Load into Form
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Job</CardTitle>
                  <CardDescription>Client context, scope, and source job description.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="job.id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job ID</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="job.clientLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Location</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="US" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="job.clientReview"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Review (0-5)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="job.clientReviewAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Review Count</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="job.clientTotalSpent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Spent ($)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="job.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {projectTypes.map((type) => (
                              <Button
                                key={type.value}
                                type="button"
                                variant={field.value === type.value ? "default" : "outline"}
                                onClick={() => field.onChange(type.value)}
                              >
                                {type.label}
                              </Button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="job.title"
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

                  <FormField
                    control={form.control}
                    name="job.skills"
                    render={() => (
                      <FormItem>
                        <FormLabel>Skills</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                value={skillInput}
                                onChange={(event) => setSkillInput(event.target.value)}
                                placeholder="Add skill and press Enter"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    addSkill();
                                  }
                                }}
                              />
                              <Button type="button" variant="secondary" onClick={addSkill}>
                                Add
                              </Button>
                            </div>
                            {skills.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {skills.map((skill) => (
                                  <Badge
                                    key={skill}
                                    variant="secondary"
                                    className="cursor-pointer"
                                    onClick={() => removeSkill(skill)}
                                  >
                                    {skill} x
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="job.text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={8} placeholder="Full job description..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Proposal</CardTitle>
                  <CardDescription>Outcome signals and the full proposal body.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="proposal.id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proposal ID</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="proposal.jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job ID (ref)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="proposal.price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="500.00" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="proposal.memberId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Member ID (ref)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <FormField
                      control={form.control}
                      name="proposal.viewed"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <BooleanBadgeField label="Viewed" value={field.value} onChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="proposal.interview"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <BooleanBadgeField label="Interview" value={field.value} onChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="proposal.offer"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <BooleanBadgeField label="Offer" value={field.value} onChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="proposal.agency"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <BooleanBadgeField label="Agency" value={field.value} onChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="proposal.text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proposal Text</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={8} placeholder="Full proposal text..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Member</CardTitle>
                  <CardDescription>Author profile and agency context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="member.id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Member ID</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="member.name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="member.location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="UA" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="member.jss"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>JSS (0-100)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="member.talentBadge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Talent Badge</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Top Rated Plus" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="member.agency"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <BooleanBadgeField label="Agency" value={field.value} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isAgencyMember ? (
                    <FormField
                      control={form.control}
                      name="member.agencyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agency Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className={cn("mr-2 h-4 w-4 animate-spin")} />
                    Ingesting...
                  </>
                ) : (
                  "Submit Ingestion"
                )}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
