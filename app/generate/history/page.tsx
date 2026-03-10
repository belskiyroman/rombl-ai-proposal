"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { GenerationHistoryListItem } from "@/src/lib/generation-snapshot";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/src/components/ui/table";

interface CandidateProfileOption {
  _id: string;
  candidateId: number;
  displayName: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
  updatedAt: number;
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={`loading-run-${index}`}>
          <TableCell><Skeleton className="h-4 w-44" /></TableCell>
          <TableCell><Skeleton className="h-4 w-64" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-9 w-28" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export default function GenerateHistoryPage() {
  const candidates = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedCandidateId === null && candidates[0]?.candidateId) {
      setSelectedCandidateId(candidates[0].candidateId);
    }
  }, [candidates, selectedCandidateId]);

  const runs = useQuery(
    api.runs.listGenerationRuns,
    selectedCandidateId ? { candidateId: selectedCandidateId, limit: 30 } : "skip"
  ) as GenerationHistoryListItem[] | undefined;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Saved Proposal Runs</h1>
            <p className="text-sm text-muted-foreground">
              Review immutable generation snapshots, evaluator traces, and proposal analytics.
            </p>
          </div>
          <Button asChild>
            <Link href="/generate">Back to Generator</Link>
          </Button>
        </div>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="font-medium">No candidate profile found.</p>
              <p className="text-sm text-muted-foreground">Create a candidate profile before saving and reviewing runs.</p>
              <Button asChild variant="outline">
                <Link href="/ingest">Open Candidate Console</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Candidate Scope</CardTitle>
                <CardDescription>Select which candidate history to inspect.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {candidates.map((candidate) => (
                  <Button
                    key={candidate._id}
                    type="button"
                    size="sm"
                    variant={selectedCandidateId === candidate.candidateId ? "default" : "outline"}
                    onClick={() => setSelectedCandidateId(candidate.candidateId)}
                  >
                    {candidate.displayName} #{candidate.candidateId}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Runs</CardTitle>
                <CardDescription>Newest immutable snapshots first.</CardDescription>
              </CardHeader>
              <CardContent>
                {!runs ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Revisions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <LoadingRows />
                    </TableBody>
                  </Table>
                ) : runs.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="font-medium">No saved runs yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Generate a proposal to create the first immutable run snapshot.
                    </p>
                    <Button asChild variant="outline" className="mt-4">
                      <Link href="/generate">Generate Proposal</Link>
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Revisions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => (
                        <TableRow key={run._id}>
                          <TableCell>
                            <div className="font-medium">{run.jobTitle}</div>
                            <div className="text-xs text-muted-foreground">{formatTimestamp(run.createdAt)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{run.jobSummary}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{run.finalProposalPreview}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={run.approvalStatus === "APPROVED" ? "default" : "outline"}>
                                {run.approvalStatus}
                              </Badge>
                              {run.copyRiskTriggered ? <Badge variant="secondary">Copy Risk</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>{run.revisionCount}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/generate/history/${run._id}`}>Open Snapshot</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
