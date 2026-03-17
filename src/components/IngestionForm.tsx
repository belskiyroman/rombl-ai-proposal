"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAction, useQuery } from "convex/react";
import { useForm } from "react-hook-form";
import type { Id } from "@/convex/_generated/dataModel";

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

interface CandidateProfileDetail {
  _id: string;
  candidateId: number;
  displayName: string;
  positioningSummary: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
  metadata: {
    seniority?: string;
    availability?: string;
    location?: string;
    notes?: string;
    externalProfiles?: {
      githubUrl?: string;
      websiteUrl?: string;
      portfolioUrl?: string;
    };
  };
  activeEvidenceCount: number;
  historicalEvidenceCount: number;
  updatedAt: number;
}

interface CandidateEvidenceBlockRow {
  _id: string;
  candidateId: number;
  type: string;
  text: string;
  tags: string[];
  techStack: string[];
  domains: string[];
  confidence: number;
  active: boolean;
  updatedAt: number;
}

interface IngestionFormProps {
  onSuccess: (data: ExtractionResultsData) => void;
}

const toneOptions = ["concise", "consultative", "confident", "technical", "founder-like"] as const;

function createProfileDefaults(candidateId: number): CandidateProfileFormValues {
  return {
    candidateId,
    displayName: "",
    positioningSummary: "",
    toneProfile: "consultative",
    coreDomains: [],
    preferredCtaStyle: "Short confident CTA with a clear next step",
    seniority: "",
    availability: "",
    location: "",
    notes: "",
    githubUrl: "",
    websiteUrl: "",
    portfolioUrl: ""
  };
}

function createEvidenceDefaults(candidateId: number): CandidateEvidenceFormValues {
  return {
    candidateId,
    rawEvidenceText: ""
  };
}

function createHistoricalDefaults(candidateId: number): HistoricalCaseFormValues {
  return {
    candidateId,
    jobTitle: "",
    jobDescription: "",
    proposalText: "",
    reply: false,
    interview: false,
    hired: false
  };
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function IngestionForm({ onSuccess }: IngestionFormProps) {
  const [mode, setMode] = useState<"profile" | "evidence" | "case">("profile");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const { toast } = useToast();

  const profileOptions = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];
  const nextCandidateId = (useQuery(api.profiles.getNextCandidateId) as number | undefined) ?? 1;
  const selectedProfile = useQuery(
    api.profiles.getCandidateProfile,
    selectedCandidateId !== null ? { candidateId: selectedCandidateId } : "skip"
  ) as CandidateProfileDetail | null | undefined;
  const candidateEvidenceBlocks = (useQuery(
    api.profiles.listCandidateEvidenceBlocks,
    selectedCandidateId !== null ? { candidateId: selectedCandidateId } : "skip"
  ) as CandidateEvidenceBlockRow[] | undefined) ?? [];

  const upsertCandidateProfile = useAction(api.profiles.upsertCandidateProfile);
  const ingestCandidateEvidence = useAction(api.profiles.ingestCandidateEvidence);
  const deleteCandidateEvidenceBlock = useAction(api.profiles.deleteCandidateEvidenceBlock);
  const deleteCandidate = useAction(api.profiles.deleteCandidate);
  const ingestHistoricalCase = useAction(api.cases.ingestHistoricalCase);

  const profileForm = useForm<CandidateProfileFormValues>({
    resolver: zodResolver(candidateProfileFormSchema),
    defaultValues: createProfileDefaults(nextCandidateId)
  });
  const evidenceForm = useForm<CandidateEvidenceFormValues>({
    resolver: zodResolver(candidateEvidenceFormSchema),
    defaultValues: createEvidenceDefaults(nextCandidateId)
  });
  const historicalForm = useForm<HistoricalCaseFormValues>({
    resolver: zodResolver(historicalCaseFormSchema),
    defaultValues: createHistoricalDefaults(nextCandidateId)
  });

  const isWorking =
    profileForm.formState.isSubmitting ||
    evidenceForm.formState.isSubmitting ||
    historicalForm.formState.isSubmitting;

  const candidateExists = Boolean(selectedProfile);
  const workspaceCandidateId = selectedCandidateId ?? nextCandidateId;

  useEffect(() => {
    if (selectedCandidateId !== null) {
      return;
    }

    if (profileOptions[0]?.candidateId) {
      setSelectedCandidateId(profileOptions[0].candidateId);
      return;
    }

    setSelectedCandidateId(nextCandidateId);
  }, [nextCandidateId, profileOptions, selectedCandidateId]);

  useEffect(() => {
    if (selectedCandidateId === null) {
      return;
    }

    if (selectedProfile === undefined) {
      return;
    }

    if (selectedProfile) {
      profileForm.reset({
        candidateId: selectedProfile.candidateId,
        displayName: selectedProfile.displayName,
        positioningSummary: selectedProfile.positioningSummary,
        toneProfile: selectedProfile.toneProfile as CandidateProfileFormValues["toneProfile"],
        coreDomains: selectedProfile.coreDomains,
        preferredCtaStyle: selectedProfile.preferredCtaStyle,
        seniority: selectedProfile.metadata.seniority ?? "",
        availability: selectedProfile.metadata.availability ?? "",
        location: selectedProfile.metadata.location ?? "",
        notes: selectedProfile.metadata.notes ?? "",
        githubUrl: selectedProfile.metadata.externalProfiles?.githubUrl ?? "",
        websiteUrl: selectedProfile.metadata.externalProfiles?.websiteUrl ?? "",
        portfolioUrl: selectedProfile.metadata.externalProfiles?.portfolioUrl ?? ""
      });
    } else {
      profileForm.reset(createProfileDefaults(selectedCandidateId));
    }

    evidenceForm.reset(createEvidenceDefaults(selectedCandidateId));
    historicalForm.reset(createHistoricalDefaults(selectedCandidateId));
    setDomainInput("");
  }, [selectedCandidateId, selectedProfile, profileForm, evidenceForm, historicalForm]);

  const selectedCandidateOption = useMemo(
    () => profileOptions.find((profile) => profile.candidateId === selectedCandidateId) ?? null,
    [profileOptions, selectedCandidateId]
  );

  function selectCandidate(candidateId: number) {
    setSelectedCandidateId(candidateId);
  }

  function createNewCandidate() {
    setSelectedCandidateId(nextCandidateId);
    setMode("profile");
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

  function removeDomain(domain: string) {
    const nextDomains = profileForm.getValues("coreDomains").filter((item) => item !== domain);
    profileForm.setValue("coreDomains", nextDomains, {
      shouldDirty: true,
      shouldValidate: true
    });
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
          notes: values.notes || undefined,
          externalProfiles: {
            githubUrl: values.githubUrl || undefined,
            websiteUrl: values.websiteUrl || undefined,
            portfolioUrl: values.portfolioUrl || undefined
          }
        }
      });

      setSelectedCandidateId(result.candidateId);
      onSuccess({
        operation: "profile",
        candidateId: result.candidateId,
        profileId: result.profileId,
        evidenceCount: result.evidenceCount
      });

      toast({
        title: candidateExists ? "Candidate updated" : "Candidate created",
        description: "Profile summary and derived evidence blocks are now available for retrieval."
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

      evidenceForm.reset(createEvidenceDefaults(values.candidateId));
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

      historicalForm.reset(createHistoricalDefaults(values.candidateId));
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

  async function onDeleteEvidenceBlock(evidenceBlockId: string) {
    const confirmed = window.confirm("Delete this candidate evidence block?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteCandidateEvidenceBlock({
        evidenceBlockId: evidenceBlockId as Id<"candidate_evidence_blocks">
      });

      toast({
        title: "Evidence deleted",
        description: "The candidate evidence block was removed."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown evidence delete error";
      toast({
        title: "Delete failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  async function onDeleteCandidate() {
    if (!selectedProfile) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedProfile.displayName} and all linked evidence, historical cases, clusters, and saved runs?`
    );
    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteCandidate({
        candidateId: selectedProfile.candidateId
      });

      setSelectedCandidateId(null);

      toast({
        title: "Candidate deleted",
        description: `Removed ${result.deletedHistoricalCases} cases, ${result.deletedEvidenceBlocks} evidence blocks, and ${result.deletedGenerationRuns} saved runs.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown candidate delete error";
      toast({
        title: "Candidate delete failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="section-label">Workspace</p>
            <CardTitle className="text-xl">Candidate Console</CardTitle>
            <CardDescription>
              Build candidate memory, manage grounded evidence, and ingest historical cases into the library.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href="/pairs">Open Library</Link>
            </Button>
            <Button type="button" onClick={createNewCandidate}>
              <Plus className="h-4 w-4" />
              New Candidate
            </Button>
            <Button type="button" variant="destructive" onClick={onDeleteCandidate} disabled={!selectedProfile || isWorking}>
              <Trash2 className="h-4 w-4" />
              Delete Candidate
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {profileOptions.map((profile) => (
            <Button
              key={profile._id}
              type="button"
              size="sm"
              variant={selectedCandidateId === profile.candidateId ? "default" : "outline"}
              onClick={() => selectCandidate(profile.candidateId)}
            >
              {profile.displayName} #{profile.candidateId}
            </Button>
          ))}
          {!candidateExists ? (
            <Badge variant="secondary">Draft candidate #{workspaceCandidateId}</Badge>
          ) : null}
          {profileOptions.length === 0 ? <Badge variant="outline">No candidates yet</Badge> : null}
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 border border-white/[0.06]">
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${mode === "profile"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            onClick={() => setMode("profile")}
          >
            Candidate Profile
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${mode === "evidence"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            onClick={() => setMode("evidence")}
          >
            Candidate Evidence
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${mode === "case"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            onClick={() => setMode("case")}
          >
            Historical Case
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="section-label">Workspace</p>
              <h3 className="mt-2 text-xl font-semibold">
                {selectedProfile?.displayName ?? `New Candidate #${workspaceCandidateId}`}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedProfile
                  ? selectedProfile.positioningSummary
                  : "Create the candidate profile first, then add evidence and historical cases against this workspace."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="stat-card">
                  <p className="section-label">Tone</p>
                  <p className="mt-2 text-lg font-semibold capitalize">
                    {selectedProfile?.toneProfile ?? profileForm.watch("toneProfile")}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="section-label">Evidence</p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedProfile?.activeEvidenceCount ?? 0} active
                  </p>
                </div>
                <div className="stat-card">
                  <p className="section-label">Case-derived Signals</p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedProfile?.historicalEvidenceCount ?? 0}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="section-label">Updated</p>
                  <p className="mt-2 text-sm font-medium">
                    {selectedProfile ? formatTimestamp(selectedProfile.updatedAt) : "Not saved yet"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(selectedProfile?.coreDomains ?? profileForm.watch("coreDomains")).map((domain) => (
                  <Badge key={domain} variant="outline">
                    {domain}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Candidate Evidence</p>
                  <p className="text-sm text-muted-foreground">Manage authored evidence blocks attached to this candidate.</p>
                </div>
                <Badge variant="secondary">{candidateEvidenceBlocks.length}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {candidateEvidenceBlocks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/[0.08] p-4 text-sm text-muted-foreground">
                    No candidate-authored evidence blocks yet.
                  </p>
                ) : (
                  candidateEvidenceBlocks.map((block) => (
                    <div key={block._id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge>{block.type}</Badge>
                            <Badge variant="outline">Confidence {block.confidence.toFixed(2)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{block.text}</p>
                        </div>
                        <Button type="button" size="icon" variant="ghost" onClick={() => onDeleteEvidenceBlock(block._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {block.tags.map((tag) => (
                          <Badge key={`${block._id}-${tag}`} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                        {block.techStack.map((tech) => (
                          <Badge key={`${block._id}-${tech}`} variant="outline">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main form area */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {mode === "profile" ? (
              <Form {...profileForm}>
                <form className="space-y-5" onSubmit={profileForm.handleSubmit(onSubmitProfile)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{candidateExists ? "Edit Candidate Profile" : "Create Candidate Profile"}</h3>
                      <p className="text-sm text-muted-foreground">
                        The candidate profile is the source of truth for positioning and style.
                      </p>
                    </div>
                    <Badge variant="outline">Candidate #{workspaceCandidateId}</Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={profileForm.control}
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
                      control={profileForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Roman Belskiy" />
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
                            rows={7}
                            placeholder="Senior full-stack engineer focused on MVP delivery, architecture ownership, product thinking, and high-signal communication..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      control={profileForm.control}
                      name="toneProfile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tone Profile</FormLabel>
                          <FormControl>
                            <div className="flex flex-wrap gap-2">
                              {toneOptions.map((tone) => (
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

                  <div className="space-y-3">
                    <FormLabel>Core Domains</FormLabel>
                    <div className="flex gap-2">
                      <Input
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                        placeholder="SaaS, Healthcare, AI..."
                      />
                      <Button type="button" variant="outline" onClick={addDomain}>
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profileForm.watch("coreDomains").map((domain) => (
                        <div key={domain} className="flex items-center gap-1 rounded-full border border-white/[0.08] px-3 py-1 text-sm">
                          <span>{domain}</span>
                          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => removeDomain(domain)}>
                            ×
                          </button>
                        </div>
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
                            <Input {...field} placeholder="Senior / Lead" />
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
                            <Input {...field} placeholder="30 hrs/week" />
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
                            <Input {...field} placeholder="Kyiv, Ukraine" />
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
                            <Input {...field} placeholder="Founder-friendly, strong architecture ownership..." />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={profileForm.control}
                      name="githubUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GitHub URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://github.com/username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="websiteUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://example.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="portfolioUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portfolio URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://portfolio.example.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isWorking}>
                    {profileForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {candidateExists ? "Save Profile" : "Create Candidate"}
                  </Button>
                </form>
              </Form>
            ) : null}

            {mode === "evidence" ? (
              <Form {...evidenceForm}>
                <form className="space-y-5" onSubmit={evidenceForm.handleSubmit(onSubmitEvidence)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Add Candidate Evidence</h3>
                      <p className="text-sm text-muted-foreground">
                        Paste grounded notes about projects, tech depth, outcomes, and ownership.
                      </p>
                    </div>
                    <Badge variant="outline">Candidate #{workspaceCandidateId}</Badge>
                  </div>

                  <FormField
                    control={evidenceForm.control}
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
                    control={evidenceForm.control}
                    name="rawEvidenceText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raw Evidence Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={12}
                            placeholder="Built scalable SaaS MVPs in Next.js and Node.js, owned architecture decisions, handled stakeholder communication, and shipped production integrations..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isWorking || !candidateExists}>
                    {evidenceForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Ingest Evidence
                  </Button>
                </form>
              </Form>
            ) : null}

            {mode === "case" ? (
              <Form {...historicalForm}>
                <form className="space-y-5" onSubmit={historicalForm.handleSubmit(onSubmitHistoricalCase)}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Ingest Historical Case</h3>
                      <p className="text-sm text-muted-foreground">
                        Add a job and its real proposal so the library can extract signals, fragments, and clusters.
                      </p>
                    </div>
                    <Badge variant="outline">Candidate #{workspaceCandidateId}</Badge>
                  </div>

                  <FormField
                    control={historicalForm.control}
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
                    control={historicalForm.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Senior Full-Stack Developer for SaaS MVP" />
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
                          <Textarea {...field} rows={9} />
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
                          <Textarea {...field} rows={9} />
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
                        onClick={() =>
                          historicalForm.setValue(fieldName, !historicalForm.watch(fieldName), {
                            shouldDirty: true,
                            shouldValidate: true
                          })
                        }
                      >
                        {fieldName}
                      </Button>
                    ))}
                  </div>

                  <Button type="submit" disabled={isWorking || !candidateExists}>
                    {historicalForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Ingest Historical Case
                  </Button>
                </form>
              </Form>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
