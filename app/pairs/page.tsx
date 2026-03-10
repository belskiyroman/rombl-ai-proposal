"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
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

function LoadingTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Signals</TableHead>
          <TableHead>Cluster</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 4 }).map((_, index) => (
          <TableRow key={`loading-${index}`}>
            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
            <TableCell><Skeleton className="h-4 w-64" /></TableCell>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function PairsPage() {
  const candidates = (useQuery(api.profiles.listCandidateProfiles) as CandidateProfileOption[] | undefined) ?? [];
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedCandidateId === null && candidates[0]?.candidateId) {
      setSelectedCandidateId(candidates[0].candidateId);
    }
  }, [candidates, selectedCandidateId]);

  const canonicalCases = useQuery(
    api.library.listCanonicalCases,
    selectedCandidateId ? { candidateId: selectedCandidateId, limit: 25 } : "skip"
  ) as CanonicalCaseRow[] | undefined;
  const clusters = useQuery(
    api.library.listClusters,
    selectedCandidateId ? { candidateId: selectedCandidateId } : "skip"
  ) as ClusterRow[] | undefined;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Canonical Library</h1>
            <p className="text-sm text-muted-foreground">
              Review canonical cases, cluster diversity, and the reusable proposal memory behind V2 generation.
            </p>
          </div>
          <Link href="/ingest">
            <Button>Open Ingestion Console</Button>
          </Link>
        </div>

        {candidates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="font-medium">No candidate profile found.</p>
              <p className="text-sm text-muted-foreground">Create a candidate profile before building the V2 library.</p>
              <Link href="/ingest">
                <Button variant="outline">Create Profile</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Candidate Scope</CardTitle>
                <CardDescription>Select which candidate library to inspect.</CardDescription>
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
                <CardTitle>Canonical Cases</CardTitle>
                <CardDescription>One representative exemplar per proposal cluster.</CardDescription>
              </CardHeader>
              <CardContent>
                {!canonicalCases ? (
                  <LoadingTable />
                ) : canonicalCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No canonical cases available for this candidate yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Signals</TableHead>
                        <TableHead>Cluster</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {canonicalCases.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell>
                            <div className="font-medium">{item.jobTitle}</div>
                            <div className="text-xs text-muted-foreground">{item.summary}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge>{item.domain}</Badge>
                              <Badge variant="secondary">{item.projectType}</Badge>
                              <Badge variant="outline">{item.tone}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">Cluster {item.clusterId?.slice(0, 6) ?? "new"}</div>
                            <div className="text-xs text-muted-foreground">{item.clusterSize} variants</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Duplicate Clusters</CardTitle>
                <CardDescription>Near-duplicate control used to keep retrieval diverse.</CardDescription>
              </CardHeader>
              <CardContent>
                {!clusters ? (
                  <LoadingTable />
                ) : clusters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clusters created yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Representative</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Quality</TableHead>
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
