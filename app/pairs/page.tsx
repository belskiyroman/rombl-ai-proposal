"use client";

import Link from "next/link";
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          <TableCell>
            <Skeleton className="h-4 w-56" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-9 w-36" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function PairsPage() {
  const pairs = useQuery(api.jobs.getPairs, { limit: 50 });
  const isLoading = pairs === undefined;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">
              Browse ingested job-proposal pairs and launch generation from prior context.
            </p>
          </div>
          <Link href="/ingest">
            <Button>Add New Pair</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ingested Pairs</CardTitle>
            <CardDescription>Sorted by most recent ingestion first.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Proposal Price</TableHead>
                    <TableHead>Tech Stack</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <LoadingRows />
                </TableBody>
              </Table>
            ) : pairs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-medium">No pairs ingested yet. Add your first job-proposal pair.</p>
                <p className="mt-1 text-sm text-muted-foreground">Start ingestion to build your retrieval memory.</p>
                <Link href="/ingest" className="mt-4 inline-block">
                  <Button variant="outline">Add New Pair</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Proposal Price</TableHead>
                    <TableHead>Tech Stack</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairs.map((pair) => (
                    <TableRow key={pair.processedProposalId}>
                      <TableCell>
                        <div className="font-medium">{pair.job.title}</div>
                        <div className="text-xs text-muted-foreground">Job #{pair.job.externalJobId}</div>
                      </TableCell>
                      <TableCell>
                        <div>{formatCurrency(pair.job.clientTotalSpent)}</div>
                        <div className="text-xs text-muted-foreground">Review: {pair.job.clientReview.toFixed(1)} / 5</div>
                      </TableCell>
                      <TableCell>{pair.proposal.price}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {pair.job.techStack.map((skill) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/generate?contextId=${pair.job.externalJobId}`}>
                          <Button size="sm" variant="outline">
                            Generate from this
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
