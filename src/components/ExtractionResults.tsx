"use client";

import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

export type ExtractionResultsData =
  | {
    operation: "profile";
    candidateId: number;
    profileId: string;
    evidenceCount: number;
  }
  | {
    operation: "evidence";
    candidateId: number;
    evidenceCount: number;
  }
  | {
    operation: "case";
    historicalCaseId: string;
    clusterId: string | null;
    canonical: boolean;
    fragmentIds: string[];
    evidenceIds: string[];
    jobExtract?: {
      projectType: string;
      domain: string;
      stack: string[];
      clientNeeds: string[];
      summary: string;
    } | null;
    proposalExtract?: {
      hook: string;
      tone: string;
      valueProposition: string;
    } | null;
    quality?: {
      overall: number;
      humanScore: number;
      specificityScore: number;
      genericnessScore: number;
    } | null;
  };

interface ExtractionResultsProps {
  data: ExtractionResultsData;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <p className="section-label">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function ExtractionResults({ data }: ExtractionResultsProps) {
  if (data.operation === "profile") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Candidate Profile Saved</CardTitle>
          <CardDescription>Profile and derived evidence blocks are now available for retrieval.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Candidate" value={data.candidateId} />
          <MetricCard label="Profile ID" value={data.profileId} />
          <MetricCard label="Evidence Blocks" value={data.evidenceCount} />
        </CardContent>
      </Card>
    );
  }

  if (data.operation === "evidence") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence Ingested</CardTitle>
          <CardDescription>Candidate evidence is now searchable for grounded proposal generation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <MetricCard label="Candidate" value={data.candidateId} />
          <MetricCard label="Evidence Blocks" value={data.evidenceCount} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Historical Case Ingested</CardTitle>
              <CardDescription>Case, cluster, fragments, and seed evidence were generated for the live engine.</CardDescription>
            </div>
            <Badge variant={data.canonical ? "success" : "outline"}>
              {data.canonical ? "Canonical" : "Variant"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Case ID" value={data.historicalCaseId} />
          <MetricCard label="Cluster ID" value={data.clusterId ?? "New"} />
          <MetricCard label="Fragments" value={data.fragmentIds.length} />
        </CardContent>
      </Card>

      {data.jobExtract ? (
        <Card>
          <CardHeader>
            <CardTitle>Job Understanding Snapshot</CardTitle>
            <CardDescription>Structured metadata extracted from the ingested historical job.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{data.jobExtract.summary}</p>
            <div className="flex flex-wrap gap-2">
              <Badge>{data.jobExtract.projectType}</Badge>
              <Badge variant="secondary">{data.jobExtract.domain}</Badge>
              {data.jobExtract.stack.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.proposalExtract ? (
        <Card>
          <CardHeader>
            <CardTitle>Proposal Pattern Snapshot</CardTitle>
            <CardDescription>Key persuasive components extracted from the historical proposal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">Hook</p>
            <p className="text-sm text-muted-foreground">{data.proposalExtract.hook}</p>
            <div className="flex flex-wrap gap-2">
              <Badge>{data.proposalExtract.tone}</Badge>
              <Badge variant="outline">{data.proposalExtract.valueProposition}</Badge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.quality ? (
        <Card>
          <CardHeader>
            <CardTitle>Quality Signals</CardTitle>
            <CardDescription>Stored quality scores used later during retrieval and ranking.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Overall" value={data.quality.overall.toFixed(2)} />
            <MetricCard label="Human Score" value={data.quality.humanScore.toFixed(2)} />
            <MetricCard label="Specificity" value={data.quality.specificityScore.toFixed(2)} />
            <MetricCard label="Genericness" value={data.quality.genericnessScore.toFixed(2)} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
