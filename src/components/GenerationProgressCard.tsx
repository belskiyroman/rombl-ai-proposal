"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import type { GenerationProgressData } from "@/src/lib/generation-progress";
import { getProposalEngineStepLabel, proposalEngineStepOrder } from "@/src/lib/proposal-engine/progress";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

interface GenerationProgressCardProps {
  progress: GenerationProgressData | null | undefined;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

function getPipelineStepStatus(progress: GenerationProgressData, step: string): "pending" | "running" | "completed" | "failed" {
  if (progress.steps.some((item) => item.step === step && item.status === "FAILED")) {
    return "failed";
  }

  if (progress.currentStep?.step === step) {
    return "running";
  }

  if (progress.steps.some((item) => item.step === step && item.status === "COMPLETED")) {
    return "completed";
  }

  return "pending";
}

export function GenerationProgressCard({ progress }: GenerationProgressCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!progress || (progress.status !== "RUNNING" && progress.status !== "QUEUED")) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [progress]);

  const totalDuration = useMemo(() => {
    if (!progress) {
      return null;
    }

    if (typeof progress.totalDurationMs === "number") {
      return progress.totalDurationMs;
    }

    return Math.max(0, now - progress.startedAt);
  }, [now, progress]);

  if (progress === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Generation Progress</CardTitle>
          <CardDescription>Connecting to live progress feed...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for Convex progress data.
        </CardContent>
      </Card>
    );
  }

  if (progress === null) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Generation Progress</CardTitle>
            <CardDescription>
              {progress.currentStep
                ? `${progress.currentStep.label} is running now.`
                : progress.status === "COMPLETED"
                  ? "Generation completed."
                  : progress.status === "FAILED"
                    ? "Generation failed."
                    : "Generation is queued."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={progress.status === "COMPLETED" ? "success" : progress.status === "FAILED" ? "destructive" : "outline"}>
              {progress.status}
            </Badge>
            {typeof totalDuration === "number" ? (
              <Badge variant="secondary">{formatDuration(totalDuration)}</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {proposalEngineStepOrder.map((step) => {
            const status = getPipelineStepStatus(progress, step);

            return (
              <div key={step} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                <p className="text-sm font-medium">{getProposalEngineStepLabel(step)}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">{status}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Live Step Events</p>
            <p className="text-xs text-muted-foreground">
              Completed stages show exact durations; the running stage updates live.
            </p>
          </div>

          {progress.steps.length === 0 && progress.status === "QUEUED" ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Waiting for the first backend step to start.
            </div>
          ) : (
            progress.steps.map((step, index) => {
              const isActive =
                progress.currentStep?.step === step.step && progress.currentStep.attempt === step.attempt;
              const displayDuration =
                typeof step.durationMs === "number"
                  ? step.durationMs
                  : isActive
                    ? Math.max(0, now - step.startedAt)
                    : null;

              return (
                <div
                  key={`${step.step}-${step.attempt}-${index}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{step.label}</Badge>
                    <Badge variant="outline">Attempt {step.attempt}</Badge>
                    <Badge variant={step.status === "COMPLETED" ? "success" : step.status === "FAILED" ? "destructive" : "secondary"}>
                      {step.status}
                    </Badge>
                    {isActive ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Started {new Date(step.startedAt).toLocaleTimeString()}.
                    {displayDuration !== null ? ` Duration ${formatDuration(displayDuration)}.` : ""}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {progress.errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {progress.errorMessage}
          </div>
        ) : null}

        {progress.generationRunId ? (
          <Button asChild variant="outline">
            <Link href={`/generate/history/${progress.generationRunId}`}>Open Saved Run</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
