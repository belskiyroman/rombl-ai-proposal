"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useAction, useQuery } from "convex/react";
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
import {
  candidateEvidenceFormSchema,
  candidateProfileFormSchema,
  historicalCaseFormSchema,
  type CandidateEvidenceFormValues,
  type CandidateProfileFormValues,
  type HistoricalCaseFormValues
} from "@/lib/schemas/ingestion-form-schema";

interface CandidateProfileOption {
  _id: string;
  candidateId: number;
  displayName: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
  updatedAt: number;
}

interface IngestionFormProps {
  onSuccess: (data: ExtractionResultsData) => void;
}

const profileDefaults: CandidateProfileFormValues = {
  candidateId: 1,
  displayName: "",
  positioningSummary: "",
  toneProfile: "consultative",
  coreDomains: [],
  preferredCtaStyle: "Short confident CTA with a clear next step",
  seniority: "",
  availability: "",
  location: "",
  notes: ""
};

const evidenceDefaults: CandidateEvidenceFormValues = {
  candidateId: 1,
  rawEvidenceText: ""
};

const historicalDefaults: HistoricalCaseFormValues = {
  candidateId: 1,
  jobTitle: "",
  jobDescription: "",
  proposalText: "",
  reply: false,
  interview: false,
  hired: false
};

export function IngestionForm({ onSuccess }: IngestionFormProps) {
  const [mode, setMode] = useState<"profile" | "evidence" | "case">("profile");
  const [domainInput, setDomainInput] = useState("");
  const { toast } = useToast();

  const profileOptions = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];
  const upsertCandidateProfile = useAction(api.profiles.upsertCandidateProfile);
  const ingestCandidateEvidence = useAction(api.profiles.ingestCandidateEvidence);
  const ingestHistoricalCase = useAction(api.cases.ingestHistoricalCase);
  const backfillFromV1 = useAction(api.cases.backfillFromV1);

  const profileForm = useForm<CandidateProfileFormValues>({
    resolver: zodResolver(candidateProfileFormSchema),
    defaultValues: profileDefaults
  });
  const evidenceForm = useForm<CandidateEvidenceFormValues>({
    resolver: zodResolver(candidateEvidenceFormSchema),
    defaultValues: evidenceDefaults
  });
  const historicalForm = useForm<HistoricalCaseFormValues>({
    resolver: zodResolver(historicalCaseFormSchema),
    defaultValues: historicalDefaults
  });

  const isWorking =
    profileForm.formState.isSubmitting ||
    evidenceForm.formState.isSubmitting ||
    historicalForm.formState.isSubmitting;

  function applyCandidate(candidateId: number) {
    profileForm.setValue("candidateId", candidateId, { shouldDirty: true });
    evidenceForm.setValue("candidateId", candidateId, { shouldDirty: true });
    historicalForm.setValue("candidateId", candidateId, { shouldDirty: true });

    const selected = profileOptions.find((profile) => profile.candidateId === candidateId);
    if (selected) {
      profileForm.setValue("displayName", selected.displayName, { shouldDirty: true });
      profileForm.setValue("toneProfile", selected.toneProfile as CandidateProfileFormValues["toneProfile"], {
        shouldDirty: true
      });
      profileForm.setValue("coreDomains", selected.coreDomains, { shouldDirty: true });
      profileForm.setValue("preferredCtaStyle", selected.preferredCtaStyle, { shouldDirty: true });
    }
  }

  function addDomain() {
    const value = domainInput.trim();
    if (!value) {
      return;
    }

    const currentDomains = profileForm.getValues("coreDomains");
    if (!currentDomains.includes(value)) {
      profileForm.setValue("coreDomains", [...currentDomains, value], {
        shouldDirty: true,
        shouldValidate: true
      });
    }

    setDomainInput("");
  }

  async function onSubmitProfile(values: CandidateProfileFormValues) {
    try {
      const result = await upsertCandidateProfile({
        candidateId: values.candidateId,
        displayName: values.displayName,
        positioningSummary: values.positioningSummary,
        toneProfile: values.toneProfile,
        coreDomains: values.coreDomains,
        preferredCtaStyle: values.preferredCtaStyle,
        metadata: {
          seniority: values.seniority || undefined,
          availability: values.availability || undefined,
          location: values.location || undefined,
          notes: values.notes || undefined
        }
      });

      applyCandidate(values.candidateId);
      onSuccess({
        operation: "profile",
        candidateId: result.candidateId,
        profileId: result.profileId,
        evidenceCount: result.evidenceCount
      });

      toast({
        title: "Candidate profile saved",
        description: "Profile summary and derived evidence blocks are ready for V2 retrieval."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown profile ingestion error";
      toast({
        title: "Profile save failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  async function onSubmitEvidence(values: CandidateEvidenceFormValues) {
    try {
      const result = await ingestCandidateEvidence(values);

      onSuccess({
        operation: "evidence",
        candidateId: result.candidateId,
        evidenceCount: result.evidenceCount
      });

      toast({
        title: "Evidence added",
        description: "Candidate evidence blocks are now indexed for grounded generation."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown evidence ingestion error";
      toast({
        title: "Evidence ingestion failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  async function onSubmitHistoricalCase(values: HistoricalCaseFormValues) {
    try {
      const result = await ingestHistoricalCase({
        candidateId: values.candidateId,
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalText: values.proposalText,
        outcome: {
          reply: values.reply,
          interview: values.interview,
          hired: values.hired
        }
      });

      onSuccess({
        operation: "case",
        historicalCaseId: result.historicalCaseId,
        clusterId: result.clusterId,
        canonical: result.canonical,
        fragmentIds: result.fragmentIds,
        evidenceIds: result.evidenceIds,
        jobExtract: result.jobExtract
          ? {
              projectType: result.jobExtract.projectType,
              domain: result.jobExtract.domain,
              stack: result.jobExtract.stack,
              clientNeeds: result.jobExtract.clientNeeds,
              summary: result.jobExtract.summary
            }
          : null,
        proposalExtract: result.proposalExtract
          ? {
              hook: result.proposalExtract.hook,
              tone: result.proposalExtract.tone,
              valueProposition: result.proposalExtract.valueProposition
            }
          : null,
        quality: result.quality
          ? {
              overall: result.quality.overall,
              humanScore: result.quality.humanScore,
              specificityScore: result.quality.specificityScore,
              genericnessScore: result.quality.genericnessScore
            }
          : null
      });

      toast({
        title: "Historical case ingested",
        description: result.canonical
          ? "Case became the canonical representative of its cluster."
          : "Case was stored as a cluster variant."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown historical-case ingestion error";
      toast({
        title: "Case ingestion failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  async function onRunBackfill() {
    try {
      const result = await backfillFromV1({ limit: 200 });
      onSuccess({
        operation: "backfill",
        importedCount: result.importedCount,
        canonicalCount: result.canonicalCount
      });
      toast({
        title: "Backfill completed",
        description: "Legacy V1 records were transformed into V2 library artifacts."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown backfill error";
      toast({
        title: "Backfill failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">V2 Ingestion Console</CardTitle>
            <CardDescription>
              Ingest candidate profile data, atomic evidence, and historical cases for the structured proposal engine.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={onRunBackfill} disabled={isWorking}>
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Backfill V1
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={mode === "profile" ? "default" : "outline"} onClick={() => setMode("profile")}>
            Candidate Profile
          </Button>
          <Button type="button" size="sm" variant={mode === "evidence" ? "default" : "outline"} onClick={() => setMode("evidence")}>
            Candidate Evidence
          </Button>
          <Button type="button" size="sm" variant={mode === "case" ? "default" : "outline"} onClick={() => setMode("case")}>
            Historical Case
          </Button>
        </div>

        {profileOptions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profileOptions.map((profile) => (
              <Button
                key={profile._id}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => applyCandidate(profile.candidateId)}
              >
                {profile.displayName} #{profile.candidateId}
              </Button>
            ))}
          </div>
        ) : (
          <Badge variant="outline">No candidate profiles yet</Badge>
        )}
      </CardHeader>

      <CardContent>
        {mode === "profile" ? (
          <Form {...profileForm}>
            <form className="space-y-4" onSubmit={profileForm.handleSubmit(onSubmitProfile)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={profileForm.control}
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
                  control={profileForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="positioningSummary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Positioning Summary</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={6}
                        placeholder="Senior full-stack engineer focused on MVP delivery, architecture ownership, product thinking, and high-signal communication..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="toneProfile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone Profile</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2">
                          {(["concise", "consultative", "confident", "technical", "founder-like"] as const).map((tone) => (
                            <Button
                              key={tone}
                              type="button"
                              size="sm"
                              variant={field.value === tone ? "default" : "outline"}
                              onClick={() => field.onChange(tone)}
                            >
                              {tone}
                            </Button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="preferredCtaStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred CTA Style</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Core Domains</FormLabel>
                <div className="flex gap-2">
                  <Input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} />
                  <Button type="button" variant="outline" onClick={addDomain}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profileForm.watch("coreDomains").map((domain) => (
                    <Badge key={domain} variant="secondary">
                      {domain}
                    </Badge>
                  ))}
                </div>
                <FormMessage>{profileForm.formState.errors.coreDomains?.message}</FormMessage>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="seniority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seniority</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Availability</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isWorking}>
                {profileForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Profile
              </Button>
            </form>
          </Form>
        ) : null}

        {mode === "evidence" ? (
          <Form {...evidenceForm}>
            <form className="space-y-4" onSubmit={evidenceForm.handleSubmit(onSubmitEvidence)}>
              <FormField
                control={evidenceForm.control}
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
                control={evidenceForm.control}
                name="rawEvidenceText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Raw Evidence Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={10}
                        placeholder="Paste project experience, architecture ownership, domain expertise, shipped outcomes, and communication/process signals..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isWorking}>
                {evidenceForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ingest Evidence
              </Button>
            </form>
          </Form>
        ) : null}

        {mode === "case" ? (
          <Form {...historicalForm}>
            <form className="space-y-4" onSubmit={historicalForm.handleSubmit(onSubmitHistoricalCase)}>
              <FormField
                control={historicalForm.control}
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
                control={historicalForm.control}
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
              <FormField
                control={historicalForm.control}
                name="jobDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={8} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={historicalForm.control}
                name="proposalText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Historical Proposal</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={8} />
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
                    variant={historicalForm.watch(fieldName) ? "default" : "outline"}
                    onClick={() => historicalForm.setValue(fieldName, !historicalForm.watch(fieldName), { shouldDirty: true })}
                  >
                    {fieldName}
                  </Button>
                ))}
              </div>
              <Button type="submit" disabled={isWorking}>
                {historicalForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ingest Historical Case
              </Button>
            </form>
          </Form>
        ) : null}
      </CardContent>
    </Card>
  );
}
