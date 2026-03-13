import { queryGeneric } from "convex/server";
import { v } from "convex/values";

import { summarizeTelemetry, type GenerationTelemetrySummary, type GenerationStepTelemetry } from "../src/lib/ai/telemetry";
import type {
  GenerationHistoryListItem,
  GenerationRunCandidateSnapshot,
  GenerationRunRetrievedContext,
  GenerationSnapshotData
} from "../src/lib/generation-snapshot";

type StoredGenerationRun = {
  _id: string;
  candidateId: number;
  jobInput: GenerationSnapshotData["jobInput"];
  jobUnderstanding: GenerationSnapshotData["jobUnderstanding"];
  selectedEvidence: GenerationSnapshotData["selectedEvidence"];
  proposalPlan: GenerationSnapshotData["proposalPlan"];
  draftHistory: string[];
  critiqueHistory: GenerationSnapshotData["critiqueHistory"];
  copyRisk: GenerationSnapshotData["copyRisk"];
  finalProposal: string;
  approvalStatus: GenerationSnapshotData["approvalStatus"];
  executionTrace?: string[];
  stepTelemetry?: GenerationStepTelemetry[];
  telemetrySummary?: GenerationTelemetrySummary;
  retrievedContextSnapshot?: GenerationRunRetrievedContext;
  candidateSnapshot?: GenerationRunCandidateSnapshot;
  createdAt: number;
};

const emptyRetrievedContextSnapshot: GenerationRunRetrievedContext = {
  similarCases: [],
  fragments: {
    openings: [],
    proofs: [],
    closings: []
  },
  evidenceCandidates: []
};
const emptyStepTelemetry: GenerationStepTelemetry[] = [];

function fallbackCandidateSnapshot(candidateId: number): GenerationRunCandidateSnapshot {
  return {
    candidateId,
    displayName: `Candidate #${candidateId}`,
    toneProfile: "Unavailable",
    preferredCtaStyle: "Unavailable"
  };
}

function normalizeSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildProposalPreview(value: string): string {
  const normalized = normalizeSingleLine(value);
  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function countRevisions(critiqueHistory: GenerationSnapshotData["critiqueHistory"], draftHistory: string[]): number {
  const critiqueDrivenRevisions = critiqueHistory.filter((item) => item.approvalStatus === "NEEDS_REVISION").length;
  const draftDrivenRevisions = Math.max(0, draftHistory.length - 1);

  return Math.max(critiqueDrivenRevisions, draftDrivenRevisions);
}

export function buildGenerationRunListItem(record: StoredGenerationRun): GenerationHistoryListItem {
  return {
    _id: record._id,
    candidateId: record.candidateId,
    createdAt: record.createdAt,
    approvalStatus: record.approvalStatus,
    jobTitle: record.jobInput.title?.trim() || record.jobUnderstanding.jobSummary,
    jobSummary: record.jobUnderstanding.jobSummary,
    finalProposalPreview: buildProposalPreview(record.finalProposal),
    revisionCount: countRevisions(record.critiqueHistory, record.draftHistory),
    copyRiskTriggered: record.copyRisk.triggered
  };
}

export function buildGenerationRunDetail(record: StoredGenerationRun): GenerationSnapshotData {
  return {
    generationRunId: record._id,
    candidateSnapshot: record.candidateSnapshot ?? fallbackCandidateSnapshot(record.candidateId),
    jobInput: record.jobInput,
    finalProposal: record.finalProposal,
    approvalStatus: record.approvalStatus,
    critiqueHistory: record.critiqueHistory,
    executionTrace: record.executionTrace ?? [],
    stepTelemetry: record.stepTelemetry ?? emptyStepTelemetry,
    telemetrySummary: record.telemetrySummary ?? summarizeTelemetry(record.stepTelemetry ?? emptyStepTelemetry),
    selectedEvidence: record.selectedEvidence,
    retrievedContext: record.retrievedContextSnapshot ?? emptyRetrievedContextSnapshot,
    jobUnderstanding: record.jobUnderstanding,
    proposalPlan: record.proposalPlan,
    draftHistory: record.draftHistory,
    copyRisk: record.copyRisk,
    createdAt: record.createdAt
  };
}

export const listGenerationRuns = queryGeneric({
  args: {
    candidateId: v.float64(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 100));
    const records = await ctx.db
      .query("generation_runs")
      .withIndex("by_candidate_id_and_created_at", (query) => query.eq("candidateId", args.candidateId))
      .order("desc")
      .take(limit);

    return records.map((record) =>
      buildGenerationRunListItem({
        _id: String(record._id),
        ...record
      })
    );
  }
});

export const getGenerationRun = queryGeneric({
  args: {
    id: v.id("generation_runs")
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) {
      return null;
    }

    return buildGenerationRunDetail({
      _id: String(record._id),
      ...record
    });
  }
});

export const getGenerationRunById = queryGeneric({
  args: {
    id: v.string()
  },
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("generation_runs", args.id);
    if (!normalizedId) {
      return null;
    }

    const record = await ctx.db.get(normalizedId);
    if (!record) {
      return null;
    }

    return buildGenerationRunDetail({
      _id: String(record._id),
      ...record
    });
  }
});
