"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";

import { api } from "@/convex/_generated/api";
import { LibraryCaseEditorDialog, type EditableHistoricalCase } from "@/src/components/LibraryCaseEditorDialog";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/src/components/ui/table";
import { useToast } from "@/src/hooks/use-toast";

interface CandidateProfileOption {
  _id: string;
  candidateId: number;
  displayName: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
  updatedAt: number;
}

interface CanonicalCaseRow {
  _id: string;
  clusterId: string | null;
  candidateId: number;
  jobTitle: string;
  domain: string;
  projectType: string;
  summary: string;
  hook: string;
  tone: string;
  quality: {
    overall: number;
    specificityScore: number;
    genericnessScore: number;
  };
  outcome?: {
    reply?: boolean;
    interview?: boolean;
    hired?: boolean;
  };
  clusterSize: number;
  createdAt: number;
}

interface ClusterRow {
  _id: string;
  candidateId: number;
  clusterSize: number;
  qualityScore: number;
  duplicateMethod: string;
  representativeCaseId: string | null;
  representativeTitle: string;
  representativeHook: string;
  updatedAt: number;
}

interface HistoricalCaseDetail {
  _id: string;
  candidateId: number;
  clusterId: string | null;
  canonical: boolean;
  jobTitle: string;
  rawJobDescription: string;
  rawProposalText: string;
  normalizedJobDescription: string;
  normalizedProposalText: string;
  domain: string;
  projectType: string;
  jobExtract: {
    projectType: string;
    domain: string;
    requiredSkills: string[];
    optionalSkills: string[];
    senioritySignals: string[];
    deliverables: string[];
    constraints: string[];
    stack: string[];
    softSignals: string[];
    jobLengthBucket: string;
    clientNeeds: string[];
    summary: string;
  };
  proposalExtract: {
    hook: string;
    valueProposition: string;
    experienceClaims: string[];
    techMapping: string[];
    proofPoints: string[];
    cta: string;
    tone: string;
    lengthBucket: string;
    specificityScore: number;
    genericnessScore: number;
  };
  quality: {
    overall: number;
    humanScore: number;
    specificityScore: number;
    genericnessScore: number;
  };
  outcome?: {
    reply?: boolean;
    interview?: boolean;
    hired?: boolean;
  };
  cluster: {
    _id: string;
    clusterSize: number;
    qualityScore: number;
    duplicateMethod: string;
    representativeCaseId: string | null;
  } | null;
  clusterCases: Array<{
    _id: string;
    canonical: boolean;
    jobTitle: string;
    hook: string;
    overallQuality: number;
    outcome?: {
      reply?: boolean;
      interview?: boolean;
      hired?: boolean;
    };
    updatedAt: number;
  }>;
  fragments: Array<{
    _id: string;
    fragmentType: string;
    text: string;
    tags: string[];
    qualityScore: number;
    retrievalEligible: boolean;
  }>;
  evidenceBlocks: Array<{
    _id: string;
    type: string;
    text: string;
    tags: string[];
    confidence: number;
    active: boolean;
    techStack: string[];
    domains: string[];
  }>;
  createdAt: number;
  updatedAt: number;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function OutcomeBadges({ outcome }: { outcome?: { reply?: boolean; interview?: boolean; hired?: boolean } }) {
  if (!outcome) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {outcome.reply ? <Badge variant="secondary">reply</Badge> : null}
      {outcome.interview ? <Badge variant="secondary">interview</Badge> : null}
      {outcome.hired ? <Badge variant="success">hired</Badge> : null}
    </div>
  );
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
          <Badge key={`${title}-${item}`} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`loading-case-${index}`} className="rounded-xl border border-white/[0.06] p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function PairsPage() {
  const { toast } = useToast();
  const candidates = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<EditableHistoricalCase | null>(null);

  const deleteHistoricalCase = useAction(api.cases.deleteHistoricalCase);
  const promoteHistoricalCase = useAction(api.cases.promoteHistoricalCase);

  useEffect(() => {
    if (selectedCandidateId === null && candidates[0]?.candidateId) {
      setSelectedCandidateId(candidates[0].candidateId);
    }
  }, [candidates, selectedCandidateId]);

  const canonicalCases = useQuery(
    api.library.listCanonicalCases,
    selectedCandidateId ? { candidateId: selectedCandidateId, limit: 50 } : "skip"
  ) as CanonicalCaseRow[] | undefined;
  const clusters = useQuery(
    api.library.listClusters,
    selectedCandidateId ? { candidateId: selectedCandidateId } : "skip"
  ) as ClusterRow[] | undefined;
  const selectedCase = useQuery(
    api.library.getHistoricalCaseDetail,
    selectedCaseId ? { id: selectedCaseId as Id<"historical_cases"> } : "skip"
  ) as HistoricalCaseDetail | null | undefined;

  useEffect(() => {
    if (!canonicalCases) {
      return;
    }

    if (!selectedCaseId && canonicalCases[0]?._id) {
      setSelectedCaseId(canonicalCases[0]._id);
      return;
    }

    if (selectedCaseId && selectedCase === null && canonicalCases[0]?._id) {
      setSelectedCaseId(canonicalCases[0]._id);
    }
  }, [canonicalCases, selectedCaseId, selectedCase]);

  const selectedCandidate = candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ?? null;
  const filteredCases = (canonicalCases ?? []).filter((item) => {
    const haystack = [
      item.jobTitle,
      item.summary,
      item.hook,
      item.domain,
      item.projectType,
      item.tone
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const totalVariants = (clusters ?? []).reduce((sum, cluster) => sum + cluster.clusterSize, 0);
  const averageClusterSize = clusters && clusters.length > 0 ? totalVariants / clusters.length : 0;

  function selectCandidate(candidateId: number) {
    setSelectedCandidateId(candidateId);
    setSelectedCaseId(null);
    setEditingCase(null);
  }

  function openCreateDialog() {
    setEditingCase(null);
    setEditorOpen(true);
  }

  function openEditDialog(caseRecord: HistoricalCaseDetail) {
    setEditingCase({
      _id: caseRecord._id,
      candidateId: caseRecord.candidateId,
      jobTitle: caseRecord.jobTitle,
      rawJobDescription: caseRecord.rawJobDescription,
      rawProposalText: caseRecord.rawProposalText,
      outcome: caseRecord.outcome
    });
    setEditorOpen(true);
  }

  async function onDelete(caseId: string) {
    const confirmed = window.confirm("Delete this historical case? This will also remove its fragments and inferred evidence.");
    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteHistoricalCase({
        historicalCaseId: caseId as Id<"historical_cases">
      });

      toast({
        title: "Historical case deleted",
        description: result.clusterDeleted
          ? "The case and its cluster artifacts were removed."
          : "The case was removed and the cluster representative was refreshed."
      });

      setSelectedCaseId(result.representativeCaseId ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown delete error";
      toast({
        title: "Delete failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  async function onPromote(caseId: string) {
    try {
      const result = await promoteHistoricalCase({
        historicalCaseId: caseId as Id<"historical_cases">
      });

      setSelectedCaseId(result.representativeCaseId);
      toast({
        title: "Representative updated",
        description: "The selected case is now the cluster representative used for retrieval."
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown promote error";
      toast({
        title: "Representative update failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <main className="min-h-[calc(100vh-52px)]">
      <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 animate-fade-in">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="section-label">Library Console</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Canonical Case Library</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse the proposal memory, inspect cluster variants, and maintain the historical cases that drive grounded generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/ingest">Candidate Console</Link>
            </Button>
            <Button onClick={openCreateDialog} disabled={selectedCandidateId === null}>
              New Historical Case
            </Button>
          </div>
        </div>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="font-medium">No candidate profile found.</p>
              <p className="text-sm text-muted-foreground">Create a candidate before building and managing the case library.</p>
              <Button asChild variant="outline">
                <Link href="/ingest">Create Candidate</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Candidate Scope</CardTitle>
                <CardDescription>Select the candidate whose library you want to manage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {candidates.map((candidate) => (
                    <Button
                      key={candidate._id}
                      type="button"
                      size="sm"
                      variant={selectedCandidateId === candidate.candidateId ? "default" : "outline"}
                      onClick={() => selectCandidate(candidate.candidateId)}
                    >
                      {candidate.displayName} #{candidate.candidateId}
                    </Button>
                  ))}
                </div>

                {selectedCandidate ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="stat-card">
                      <p className="section-label">Tone Profile</p>
                      <p className="mt-2 text-lg font-semibold capitalize">{selectedCandidate.toneProfile}</p>
                    </div>
                    <div className="stat-card">
                      <p className="section-label">Canonical Cases</p>
                      <p className="mt-2 text-lg font-semibold">{canonicalCases?.length ?? "..."}</p>
                    </div>
                    <div className="stat-card">
                      <p className="section-label">Clusters / Variants</p>
                      <p className="mt-2 text-lg font-semibold">
                        {clusters?.length ?? "..."} / {clusters ? totalVariants : "..."}
                      </p>
                    </div>
                    <div className="stat-card">
                      <p className="section-label">Avg Cluster Size</p>
                      <p className="mt-2 text-lg font-semibold">{averageClusterSize ? averageClusterSize.toFixed(1) : "0.0"}</p>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Canonical Cases</CardTitle>
                  <CardDescription>Search and select a representative case to inspect or edit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by title, summary, hook, domain, tone..."
                  />

                  {!canonicalCases ? (
                    <LoadingCards />
                  ) : filteredCases.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/[0.08] p-6 text-sm text-muted-foreground">
                      No canonical cases match the current filter.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCases.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => setSelectedCaseId(item._id)}
                          className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${selectedCaseId === item._id
                              ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/5"
                              : "border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02]"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{item.jobTitle}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                            </div>
                            <Badge variant={selectedCaseId === item._id ? "default" : "outline"}>
                              {item.clusterSize} variants
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm">{item.hook}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge>{item.domain}</Badge>
                            <Badge variant="secondary">{item.projectType}</Badge>
                            <Badge variant="outline">{item.tone}</Badge>
                            <Badge variant="outline">Q {item.quality.overall.toFixed(2)}</Badge>
                          </div>
                          <div className="mt-3">
                            <OutcomeBadges outcome={item.outcome} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                {!selectedCaseId ? (
                  <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      Select a canonical case to inspect its full job, proposal, fragments, evidence, and cluster variants.
                    </CardContent>
                  </Card>
                ) : selectedCase === undefined ? (
                  <Card>
                    <CardContent className="space-y-4 py-8">
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="h-40 w-full" />
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ) : selectedCase === null ? (
                  <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      This case is no longer available.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="space-y-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <CardTitle className="text-2xl">{selectedCase.jobTitle}</CardTitle>
                            <CardDescription>
                              {selectedCase.jobExtract.summary} • Updated {formatTimestamp(selectedCase.updatedAt)}
                            </CardDescription>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!selectedCase.canonical && selectedCase.cluster ? (
                              <Button type="button" variant="secondary" onClick={() => onPromote(selectedCase._id)}>
                                Make Canonical
                              </Button>
                            ) : null}
                            <Button type="button" variant="outline" onClick={() => openEditDialog(selectedCase)}>
                              Edit
                            </Button>
                            <Button type="button" variant="destructive" onClick={() => onDelete(selectedCase._id)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge>{selectedCase.domain}</Badge>
                          <Badge variant="secondary">{selectedCase.projectType}</Badge>
                          <Badge variant={selectedCase.canonical ? "success" : "outline"}>
                            {selectedCase.canonical ? "Canonical" : "Variant"}
                          </Badge>
                          {selectedCase.cluster ? (
                            <Badge variant="outline">{selectedCase.cluster.duplicateMethod}</Badge>
                          ) : null}
                        </div>
                        <OutcomeBadges outcome={selectedCase.outcome} />
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="stat-card">
                            <p className="section-label">Quality</p>
                            <p className="mt-2 text-lg font-semibold">{selectedCase.quality.overall.toFixed(2)}</p>
                          </div>
                          <div className="stat-card">
                            <p className="section-label">Specificity</p>
                            <p className="mt-2 text-lg font-semibold">{selectedCase.quality.specificityScore.toFixed(2)}</p>
                          </div>
                          <div className="stat-card">
                            <p className="section-label">Genericness</p>
                            <p className="mt-2 text-lg font-semibold">{selectedCase.quality.genericnessScore.toFixed(2)}</p>
                          </div>
                          <div className="stat-card">
                            <p className="section-label">Cluster Size</p>
                            <p className="mt-2 text-lg font-semibold">{selectedCase.cluster?.clusterSize ?? 1}</p>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                            <p className="text-sm font-medium">Raw Job Description</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                              {selectedCase.rawJobDescription}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                            <p className="text-sm font-medium">Raw Proposal Text</p>
                            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                              {selectedCase.rawProposalText}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                            <div>
                              <p className="text-sm font-medium">Proposal Structure</p>
                              <p className="mt-2 text-sm text-muted-foreground">{selectedCase.proposalExtract.valueProposition}</p>
                            </div>
                            <MiniList title="Required Skills" items={selectedCase.jobExtract.requiredSkills} />
                            <MiniList title="Client Needs" items={selectedCase.jobExtract.clientNeeds} />
                            <MiniList title="Tech Mapping" items={selectedCase.proposalExtract.techMapping} />
                            <MiniList title="Proof Points" items={selectedCase.proposalExtract.proofPoints} />
                          </div>

                          <div className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                            <div>
                              <p className="text-sm font-medium">Job and Delivery Signals</p>
                              <p className="mt-2 text-sm text-muted-foreground">{selectedCase.proposalExtract.hook}</p>
                            </div>
                            <MiniList title="Optional Skills" items={selectedCase.jobExtract.optionalSkills} />
                            <MiniList title="Deliverables" items={selectedCase.jobExtract.deliverables} />
                            <MiniList title="Constraints" items={selectedCase.jobExtract.constraints} />
                            <MiniList title="Soft Signals" items={selectedCase.jobExtract.softSignals} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Fragments and Inferred Evidence</CardTitle>
                        <CardDescription>These are the reusable artifacts derived from this case.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-3">
                          {selectedCase.fragments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No fragments derived from this case.</p>
                          ) : (
                            selectedCase.fragments.map((fragment) => (
                              <div key={fragment._id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                                <div className="flex flex-wrap gap-2">
                                  <Badge>{fragment.fragmentType}</Badge>
                                  <Badge variant={fragment.retrievalEligible ? "success" : "outline"}>
                                    {fragment.retrievalEligible ? "retrieval eligible" : "inactive"}
                                  </Badge>
                                  <Badge variant="outline">Q {fragment.qualityScore.toFixed(2)}</Badge>
                                </div>
                                <p className="mt-3 text-sm">{fragment.text}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {fragment.tags.map((tag) => (
                                    <Badge key={`${fragment._id}-${tag}`} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="space-y-3">
                          {selectedCase.evidenceBlocks.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No inferred evidence blocks were created for this case.</p>
                          ) : (
                            selectedCase.evidenceBlocks.map((block) => (
                              <div key={block._id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                                <div className="flex flex-wrap gap-2">
                                  <Badge>{block.type}</Badge>
                                  <Badge variant={block.active ? "success" : "outline"}>
                                    {block.active ? "active" : "inactive"}
                                  </Badge>
                                  <Badge variant="outline">Confidence {block.confidence.toFixed(2)}</Badge>
                                </div>
                                <p className="mt-3 text-sm">{block.text}</p>
                                <MiniList title="Tech Stack" items={block.techStack} />
                                <MiniList title="Domains" items={block.domains} />
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Cluster Variants</CardTitle>
                        <CardDescription>Inspect every case currently grouped with this representative.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedCase.clusterCases.length === 0 ? (
                          <p className="text-sm text-muted-foreground">This case is not grouped with other variants.</p>
                        ) : (
                          selectedCase.clusterCases.map((variant) => (
                            <div key={variant._id} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant={variant.canonical ? "success" : "outline"}>
                                      {variant.canonical ? "Representative" : "Variant"}
                                    </Badge>
                                    <Badge variant="outline">Q {variant.overallQuality.toFixed(2)}</Badge>
                                  </div>
                                  <p className="font-medium">{variant.jobTitle}</p>
                                  <p className="text-sm text-muted-foreground">{variant.hook}</p>
                                  <OutcomeBadges outcome={variant.outcome} />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {!variant.canonical ? (
                                    <Button type="button" variant="secondary" size="sm" onClick={() => onPromote(variant._id)}>
                                      Make Canonical
                                    </Button>
                                  ) : null}
                                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCaseId(variant._id)}>
                                    Open
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (selectedCase._id === variant._id) {
                                        openEditDialog(selectedCase);
                                      } else {
                                        setSelectedCaseId(variant._id);
                                      }
                                    }}
                                  >
                                    {selectedCase._id === variant._id ? "Edit" : "Open to Edit"}
                                  </Button>
                                  <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(variant._id)}>
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Duplicate Clusters</CardTitle>
                <CardDescription>Near-duplicate control that keeps retrieval diverse and representative-focused.</CardDescription>
              </CardHeader>
              <CardContent>
                {!clusters ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Representative</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Quality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={`cluster-loading-${index}`}>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : clusters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No duplicate clusters are available for this candidate.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Representative</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clusters.map((cluster) => (
                        <TableRow key={cluster._id}>
                          <TableCell>
                            <div className="font-medium">{cluster.representativeTitle}</div>
                            <div className="text-xs text-muted-foreground">{cluster.representativeHook}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{cluster.duplicateMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{cluster.qualityScore.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">{cluster.clusterSize} cases</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatTimestamp(cluster.updatedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <LibraryCaseEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          candidateId={selectedCandidateId}
          caseRecord={editingCase}
          onSaved={(historicalCaseId) => {
            setSelectedCaseId(historicalCaseId);
            setEditingCase(null);
          }}
        />
      </div>
    </main>
  );
}
