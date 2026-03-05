"use client";

import { useState, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useForm } from "react-hook-form";

import { api } from "@/convex/_generated/api";
import type { ExtractionResultsData } from "@/src/components/ExtractionResults";
import { parseUpworkJobHtml } from "@/src/lib/ai/html-parser";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
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
import { cn } from "@/src/lib/utils";
import {
  ingestionFormSchema,
  pasteHtmlSchema,
  pasteJsonSchema,
  type IngestionFormValues,
  type PasteHtmlValues,
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
      <Badge variant={value ? "default" : "outline"} className="cursor-pointer select-none px-3 py-1">
        {label}: {value ? "Yes" : "No"}
      </Badge>
    </button>
  );
}

export function IngestionForm({ onSuccess }: IngestionFormProps) {
  const [mode, setMode] = useState<"form" | "json" | "html">("form");
  const [skillInput, setSkillInput] = useState("");
  const [newMemberOpen, setNewMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    id: 0,
    name: "",
    location: "",
    agency: false,
    agencyName: "",
    talentBadge: "",
    jss: 0
  });

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

  const htmlForm = useForm<PasteHtmlValues>({
    resolver: zodResolver(pasteHtmlSchema),
    defaultValues: { rawHtml: "" }
  });

  const skills = form.watch("job.skills");
  const selectedMemberId = form.watch("member.id");

  const members = useQuery(api.members.listMembers) ?? [];

  function selectMember(memberId: number) {
    const member = members.find((m) => m.memberId === memberId);
    if (member) {
      applyMemberToForm({
        id: member.memberId,
        name: member.memberName,
        location: member.memberLocation,
        agency: member.agency,
        agencyName: member.agencyName ?? "",
        talentBadge: member.talentBadge ?? "",
        jss: member.jss
      });
    }
  }

  function applyMemberToForm(m: typeof newMember) {
    form.setValue("member.id", m.id, { shouldDirty: true });
    form.setValue("member.name", m.name, { shouldDirty: true });
    form.setValue("member.location", m.location, { shouldDirty: true });
    form.setValue("member.agency", m.agency, { shouldDirty: true });
    form.setValue("member.agencyName", m.agencyName, { shouldDirty: true });
    form.setValue("member.talentBadge", m.talentBadge, { shouldDirty: true });
    form.setValue("member.jss", m.jss, { shouldDirty: true });
    syncProposalMemberId(m.id);
  }

  function saveNewMember() {
    if (!newMember.id || newMember.id <= 0) {
      toast({ title: "Member ID is required", description: "Enter a positive Member ID.", variant: "destructive" });
      return;
    }
    applyMemberToForm(newMember);
    setNewMemberOpen(false);
    toast({ title: "Member added", description: `Member #${newMember.id} applied to form.` });
  }

  const resetNewMemberForm = useCallback(() => {
    setNewMember({ id: 0, name: "", location: "", agency: false, agencyName: "", talentBadge: "", jss: 0 });
  }, []);

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

  function syncProposalMemberId(nextMemberId: number) {
    const normalizedMemberId = Number.isFinite(nextMemberId) && nextMemberId > 0 ? nextMemberId : 0;
    form.setValue("proposal.memberId", normalizedMemberId, {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  async function onFormSubmit(values: IngestionFormValues) {
    try {
      const proposedMemberLocation = values.member.location?.trim().toUpperCase();
      const normalizedMemberLocation =
        proposedMemberLocation && /^[A-Z]{2,3}$/.test(proposedMemberLocation) ? proposedMemberLocation : "US";
      const normalizedMemberId = values.member.id;

      const normalizedMember = {
        id: normalizedMemberId,
        name: values.member.name?.trim() || `Member #${normalizedMemberId}`,
        agency: values.member.agency ?? values.proposal.agency,
        agencyName: values.member.agencyName?.trim() || undefined,
        talentBadge: values.member.talentBadge?.trim() || undefined,
        jss: values.member.jss ?? 0,
        location: normalizedMemberLocation
      };

      const result = await ingestAction({
        source: "manual",
        job: values.job,
        proposal: {
          ...values.proposal,
          memberId: normalizedMemberId
        },
        member: normalizedMember
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
      syncProposalMemberId(validated.member.id);
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

  async function onHtmlSubmit(values: PasteHtmlValues) {
    try {
      const parsed = parseUpworkJobHtml(values.rawHtml);
      const current = form.getValues();

      form.reset({
        ...current,
        job: {
          ...current.job,
          title: parsed.title || current.job.title,
          text: parsed.text || current.job.text,
          skills: parsed.skills.length > 0 ? parsed.skills : current.job.skills,
          type: parsed.type,
          clientLocation: parsed.clientLocation || current.job.clientLocation,
          clientReview: parsed.clientReview || current.job.clientReview,
          clientReviewAmount: parsed.clientReviewAmount || current.job.clientReviewAmount,
          clientTotalSpent: parsed.clientTotalSpent || current.job.clientTotalSpent
        }
      });

      setMode("form");

      const extractedFields = [
        parsed.title && "title",
        parsed.text && "description",
        parsed.skills.length > 0 && `${parsed.skills.length} skills`,
        parsed.clientLocation && "location",
        parsed.clientTotalSpent > 0 && "total spent"
      ].filter(Boolean);

      toast({
        title: "HTML parsed successfully",
        description:
          extractedFields.length > 0
            ? `Extracted: ${extractedFields.join(", ")}. Review Job and submit.`
            : "No fields extracted. Verify the HTML payload and try again."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid HTML payload";
      toast({
        title: "HTML parse error",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Ingest Job-Proposal Pair</CardTitle>
            <CardDescription className="mt-1">
              Submit historical Job, Proposal, and Member data to build retrieval and style profile memory.
            </CardDescription>
          </div>
          <div className="flex rounded-lg border bg-muted p-0.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "form" ? "default" : "ghost"}
              className="rounded-md"
              onClick={() => setMode("form")}
            >
              Form
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "json" ? "default" : "ghost"}
              className="rounded-md"
              onClick={() => setMode("json")}
            >
              Paste JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "html" ? "default" : "ghost"}
              className="rounded-md"
              onClick={() => setMode("html")}
            >
              Paste HTML
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
                        name={field.name}
                        ref={field.ref}
                        value={field.value ?? ""}
                        onBlur={field.onBlur}
                        onChange={(event) => field.onChange(event.target.value)}
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
        ) : mode === "html" ? (
          <Form {...htmlForm}>
            <form onSubmit={htmlForm.handleSubmit(onHtmlSubmit)} className="space-y-4">
              <FormField
                control={htmlForm.control}
                name="rawHtml"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paste Upwork Job HTML</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={16}
                        placeholder="<html>...</html>"
                        className="font-mono text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Parse HTML & Load Job
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6">
              {/* Member Selector */}
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Member</CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-sm text-primary"
                      onClick={() => {
                        resetNewMemberForm();
                        setNewMemberOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" /> New
                    </Button>
                  </div>
                  <CardDescription>
                    {members.length > 0
                      ? "Select a member to submit with this ingestion."
                      : "No members ingested yet — add one to get started."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {members.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => (
                        <Button
                          key={m.memberId}
                          type="button"
                          size="sm"
                          variant={selectedMemberId === m.memberId ? "default" : "outline"}
                          onClick={() => selectMember(m.memberId)}
                        >
                          {m.memberName || `#${m.memberId}`}
                          {m.memberLocation ? ` (${m.memberLocation})` : ""}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Click <strong>+ New</strong> above to add a member.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* New Member Dialog */}
              <Dialog open={newMemberOpen} onOpenChange={setNewMemberOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Member</DialogTitle>
                    <DialogDescription>
                      Enter the member details. They will be saved when you submit the ingestion.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="nm-id" className="text-sm font-medium">Member ID *</label>
                        <Input
                          id="nm-id"
                          type="number"
                          value={newMember.id || ""}
                          onChange={(e) => setNewMember((p) => ({ ...p, id: Number(e.target.value) }))}
                          placeholder="e.g. 20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="nm-name" className="text-sm font-medium">Name</label>
                        <Input
                          id="nm-name"
                          value={newMember.name}
                          onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Roman Belskiy"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="nm-loc" className="text-sm font-medium">Location</label>
                        <Input
                          id="nm-loc"
                          value={newMember.location}
                          onChange={(e) => setNewMember((p) => ({ ...p, location: e.target.value }))}
                          placeholder="UA"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="nm-jss" className="text-sm font-medium">JSS (0-100)</label>
                        <Input
                          id="nm-jss"
                          type="number"
                          value={newMember.jss || ""}
                          onChange={(e) => setNewMember((p) => ({ ...p, jss: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="nm-badge" className="text-sm font-medium">Talent Badge</label>
                        <Input
                          id="nm-badge"
                          value={newMember.talentBadge}
                          onChange={(e) => setNewMember((p) => ({ ...p, talentBadge: e.target.value }))}
                          placeholder="Top Rated Plus"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5"
                        onClick={() => setNewMember((p) => ({ ...p, agency: !p.agency }))}
                      >
                        <Badge variant={newMember.agency ? "default" : "outline"} className="cursor-pointer select-none px-3 py-1">
                          Agency: {newMember.agency ? "Yes" : "No"}
                        </Badge>
                      </button>
                      {newMember.agency && (
                        <Input
                          value={newMember.agencyName}
                          onChange={(e) => setNewMember((p) => ({ ...p, agencyName: e.target.value }))}
                          placeholder="Agency name"
                          className="max-w-[200px]"
                        />
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setNewMemberOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={saveNewMember}>Add Member</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Job & Proposal side by side */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Job</CardTitle>
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
                                      className="cursor-pointer gap-1 pr-1.5 hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => removeSkill(skill)}
                                    >
                                      {skill} <span className="text-[10px] leading-none">x</span>
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

                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Proposal</CardTitle>
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
                      <FormItem>
                        <FormLabel>Member ID (from Member tab)</FormLabel>
                        <FormControl>
                          <Input
                            value={selectedMemberId > 0 ? String(selectedMemberId) : ""}
                            readOnly
                            placeholder="Select Member ID in Member tab"
                          />
                        </FormControl>
                      </FormItem>
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
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold shadow-md"
                disabled={form.formState.isSubmitting}
              >
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
