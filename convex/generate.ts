import { actionGeneric, anyApi, internalMutationGeneric } from "convex/server";
import { v } from "convex/values";

import { generateEmbeddingWithTelemetry } from "../src/lib/ai/embeddings";
import type { GenerationTelemetrySummary, GenerationStepTelemetry } from "../src/lib/ai/telemetry";
import { createProposalEngineRunners } from "../src/lib/proposal-engine/agents";
import { generationJobInputSchema, type GenerationJobInput } from "../src/lib/proposal-engine/schemas";
import { runCreateProposal, runRetrieveProposalContext, type CreateProposalResult } from "../src/lib/proposal-engine/service";
import { internal } from "./_generated/api";

const generationJobInputValidator = v.object({
  title: v.optional(v.string()),
  description: v.string()
});

const selectedEvidenceValidator = v.object({
  id: v.string(),
  reason: v.string(),
  text: v.string(),
  type: v.string()
});

const proposalPlanValidator = v.object({
  openingAngle: v.string(),
  mainPoints: v.array(v.string()),
  selectedEvidenceIds: v.array(v.string()),
  selectedFragmentIds: v.array(v.string()),
  avoid: v.array(v.string()),
  ctaStyle: v.string()
});

const copyRiskValidator = v.object({
  triggered: v.boolean(),
  maxParagraphCosine: v.float64(),
  trigramOverlap: v.float64(),
  matchedCaseIds: v.array(v.string()),
  matchedFragmentIds: v.array(v.string()),
  reasons: v.array(v.string())
});

const draftCritiqueValidator = v.object({
  rubric: v.object({
    relevance: v.float64(),
    specificity: v.float64(),
    credibility: v.float64(),
    tone: v.float64(),
    clarity: v.float64(),
    ctaStrength: v.float64()
  }),
  issues: v.array(v.string()),
  revisionInstructions: v.array(v.string()),
  approvalStatus: v.union(v.literal("APPROVED"), v.literal("NEEDS_REVISION")),
  copyRisk: copyRiskValidator
});

const jobUnderstandingValidator = v.object({
  jobSummary: v.string(),
  clientNeeds: v.array(v.string()),
  mustHaveSkills: v.array(v.string()),
  niceToHaveSkills: v.array(v.string()),
  projectRiskFlags: v.array(v.string()),
  proposalStrategy: v.object({
    tone: v.union(
      v.literal("concise"),
      v.literal("consultative"),
      v.literal("confident"),
      v.literal("technical"),
      v.literal("founder-like")
    ),
    length: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    focus: v.array(v.string())
  })
});

const candidateSnapshotValidator = v.object({
  candidateId: v.float64(),
  displayName: v.string(),
  toneProfile: v.string(),
  preferredCtaStyle: v.string()
});

const retrievedCaseSnapshotValidator = v.object({
  _id: v.string(),
  clusterId: v.optional(v.union(v.string(), v.null())),
  candidateId: v.float64(),
  canonical: v.boolean(),
  jobTitle: v.string(),
  jobExtract: v.object({
    projectType: v.string(),
    domain: v.string(),
    requiredSkills: v.array(v.string()),
    optionalSkills: v.array(v.string()),
    stack: v.array(v.string()),
    clientNeeds: v.array(v.string()),
    summary: v.string()
  }),
  proposalExtract: v.object({
    hook: v.string(),
    valueProposition: v.string(),
    proofPoints: v.array(v.string()),
    tone: v.string()
  }),
  quality: v.object({
    rubric: v.object({
      relevance: v.float64(),
      specificity: v.float64(),
      credibility: v.float64(),
      tone: v.float64(),
      clarity: v.float64(),
      ctaStrength: v.float64()
    }),
    overall: v.float64(),
    humanScore: v.float64(),
    specificityScore: v.float64(),
    genericnessScore: v.float64()
  }),
  outcome: v.optional(
    v.object({
      reply: v.optional(v.boolean()),
      interview: v.optional(v.boolean()),
      hired: v.optional(v.boolean())
    })
  ),
  finalScore: v.optional(v.float64()),
  semanticScore: v.optional(v.float64())
});

const retrievedFragmentSnapshotValidator = v.object({
  _id: v.string(),
  clusterId: v.optional(v.union(v.string(), v.null())),
  candidateId: v.float64(),
  fragmentType: v.union(v.literal("opening"), v.literal("proof"), v.literal("closing")),
  text: v.string(),
  tags: v.array(v.string()),
  specificityScore: v.float64(),
  genericnessScore: v.float64(),
  qualityScore: v.float64(),
  retrievalEligible: v.boolean()
});

const retrievedEvidenceSnapshotValidator = v.object({
  _id: v.string(),
  candidateId: v.float64(),
  type: v.string(),
  text: v.string(),
  tags: v.array(v.string()),
  techStack: v.array(v.string()),
  domains: v.array(v.string()),
  confidence: v.float64(),
  active: v.boolean(),
  source: v.union(v.literal("candidate_profile"), v.literal("case_inference"))
});

const retrievedContextSnapshotValidator = v.object({
  similarCases: v.array(retrievedCaseSnapshotValidator),
  fragments: v.object({
    openings: v.array(retrievedFragmentSnapshotValidator),
    proofs: v.array(retrievedFragmentSnapshotValidator),
    closings: v.array(retrievedFragmentSnapshotValidator)
  }),
  evidenceCandidates: v.array(retrievedEvidenceSnapshotValidator)
});

const stepTokenUsageValidator = v.object({
  inputTokens: v.float64(),
  outputTokens: v.float64(),
  totalTokens: v.float64(),
  reasoningTokens: v.float64()
});

const stepTelemetryValidator = v.object({
  step: v.string(),
  stage: v.string(),
  kind: v.union(v.literal("llm"), v.literal("embedding"), v.literal("vector_search"), v.literal("query")),
  startedAt: v.float64(),
  finishedAt: v.float64(),
  durationMs: v.float64(),
  model: v.optional(v.string()),
  attempt: v.optional(v.float64()),
  limit: v.optional(v.float64()),
  resultCount: v.optional(v.float64()),
  fragmentType: v.optional(v.string()),
  tokenUsage: v.optional(stepTokenUsageValidator)
});

const telemetrySummaryValidator = v.object({
  totalSteps: v.float64(),
  totalDurationMs: v.float64(),
  totalInputTokens: v.float64(),
  totalOutputTokens: v.float64(),
  totalTokens: v.float64(),
  totalReasoningTokens: v.float64()
});

const defaultCopyRisk = {
  triggered: false,
  maxParagraphCosine: 0,
  trigramOverlap: 0,
  matchedCaseIds: [],
  matchedFragmentIds: [],
  reasons: []
};

function buildCandidateSnapshot(result: CreateProposalResult) {
  return {
    candidateId: result.state.candidateProfile.candidateId,
    displayName: result.state.candidateProfile.displayName,
    toneProfile: result.state.candidateProfile.toneProfile,
    preferredCtaStyle: result.state.candidateProfile.preferredCtaStyle
  };
}

function normalizeStepTelemetry(steps: GenerationStepTelemetry[]): GenerationStepTelemetry[] {
  return steps.map((step) => ({
    ...step,
    tokenUsage: step.tokenUsage
      ? {
          inputTokens: step.tokenUsage.inputTokens,
          outputTokens: step.tokenUsage.outputTokens,
          totalTokens: step.tokenUsage.totalTokens,
          reasoningTokens: step.tokenUsage.reasoningTokens
        }
      : undefined
  }));
}

function normalizeTelemetrySummary(summary: GenerationTelemetrySummary): GenerationTelemetrySummary {
  return {
    totalSteps: summary.totalSteps,
    totalDurationMs: summary.totalDurationMs,
    totalInputTokens: summary.totalInputTokens,
    totalOutputTokens: summary.totalOutputTokens,
    totalTokens: summary.totalTokens,
    totalReasoningTokens: summary.totalReasoningTokens
  };
}

export function buildGenerationRunDocument(args: {
  candidateId: number;
  jobInput: GenerationJobInput;
  result: CreateProposalResult;
  createdAt: number;
}) {
  const retrievedFragmentIds = [
    ...args.result.retrievedContext.fragments.openings.map((item) => item._id),
    ...args.result.retrievedContext.fragments.proofs.map((item) => item._id),
    ...args.result.retrievedContext.fragments.closings.map((item) => item._id)
  ];
  const normalizedCopyRisk = args.result.copyRisk ?? defaultCopyRisk;

  return {
    candidateId: args.candidateId,
    jobInput: args.jobInput,
    jobUnderstanding: args.result.jobUnderstanding,
    retrievedCaseIds: args.result.retrievedContext.similarCases.map((item) => item._id as never),
    retrievedFragmentIds: retrievedFragmentIds as never,
    retrievedEvidenceIds: args.result.retrievedContext.evidenceCandidates.map((item) => item._id as never),
    executionTrace: args.result.executionTrace,
    retrievedContextSnapshot: args.result.retrievedContext,
    candidateSnapshot: buildCandidateSnapshot(args.result),
    selectedEvidence: args.result.selectedEvidence,
    proposalPlan: args.result.proposalPlan,
    draftHistory: args.result.draftHistory,
    critiqueHistory: args.result.critiqueHistory,
    copyRisk: normalizedCopyRisk,
    stepTelemetry: normalizeStepTelemetry(args.result.stepTelemetry),
    telemetrySummary: normalizeTelemetrySummary(args.result.telemetrySummary),
    finalProposal: args.result.finalProposal,
    approvalStatus: args.result.approvalStatus,
    createdAt: args.createdAt,
    updatedAt: args.createdAt
  };
}

export const insertGenerationRunRecord = internalMutationGeneric({
  args: {
    document: v.object({
      candidateId: v.float64(),
      jobInput: generationJobInputValidator,
      jobUnderstanding: jobUnderstandingValidator,
      retrievedCaseIds: v.array(v.id("historical_cases")),
      retrievedFragmentIds: v.array(v.id("proposal_fragments")),
      retrievedEvidenceIds: v.array(v.id("candidate_evidence_blocks")),
      executionTrace: v.array(v.string()),
      retrievedContextSnapshot: retrievedContextSnapshotValidator,
      candidateSnapshot: candidateSnapshotValidator,
      selectedEvidence: v.array(selectedEvidenceValidator),
      proposalPlan: proposalPlanValidator,
      draftHistory: v.array(v.string()),
      critiqueHistory: v.array(draftCritiqueValidator),
      copyRisk: copyRiskValidator,
      stepTelemetry: v.array(stepTelemetryValidator),
      telemetrySummary: telemetrySummaryValidator,
      finalProposal: v.string(),
      approvalStatus: v.union(v.literal("APPROVED"), v.literal("NEEDS_REVISION")),
      createdAt: v.float64(),
      updatedAt: v.float64()
    })
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("generation_runs", args.document);
  }
});

export const createProposal = actionGeneric({
  args: {
    candidateId: v.float64(),
    jobInput: generationJobInputValidator,
    maxRevisions: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const parsedJobInput = generationJobInputSchema.parse(args.jobInput);
    const runners = createProposalEngineRunners({
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    const result = await runCreateProposal(
      {
        candidateId: args.candidateId,
        jobInput: parsedJobInput,
        maxRevisions: args.maxRevisions
      },
      {
        loadCandidateProfile: (candidateId) =>
          (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<{
            candidateId: number;
            displayName: string;
            positioningSummary: string;
            toneProfile: string;
            coreDomains: string[];
            preferredCtaStyle: string;
          } | null>)(anyApi.profiles.getCandidateProfileSummary, {
            candidateId
          }),
        retrieveContext: ({ candidateId, jobUnderstanding }) =>
          runRetrieveProposalContext(
            {
              candidateId,
              jobUnderstanding
            },
            {
              embed: (input) =>
                generateEmbeddingWithTelemetry(input, {
                  model: args.embeddingModel
                }),
              searchHistoricalCaseSummaries: async (embedding, limit) => {
                const matches = await ctx.vectorSearch("historical_cases", "by_job_summary_embedding", {
                  vector: embedding,
                  limit
                });

                return matches.map((match) => ({
                  id: String(match._id),
                  score: match._score
                }));
              },
              searchHistoricalCaseNeeds: async (embedding, limit) => {
                const matches = await ctx.vectorSearch("historical_cases", "by_needs_embedding", {
                  vector: embedding,
                  limit
                });

                return matches.map((match) => ({
                  id: String(match._id),
                  score: match._score
                }));
              },
              searchProposalFragments: async (_fragmentType, embedding, limit) => {
                const matches = await ctx.vectorSearch("proposal_fragments", "by_embedding", {
                  vector: embedding,
                  limit
                });

                return matches.map((match) => ({
                  id: String(match._id),
                  score: match._score
                }));
              },
              searchCandidateEvidence: async (embedding, limit) => {
                const matches = await ctx.vectorSearch("candidate_evidence_blocks", "by_embedding", {
                  vector: embedding,
                  limit
                });

                return matches.map((match) => ({
                  id: String(match._id),
                  score: match._score
                }));
              },
              getHistoricalCasesByIds: (ids) =>
                (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<any[]>)(
                  anyApi.library.getHistoricalCasesByIds,
                  {
                    ids: ids as never
                  }
                ),
              getProposalFragmentsByIds: (ids) =>
                (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<any[]>)(
                  anyApi.library.getProposalFragmentsByIds,
                  {
                    ids: ids as never
                  }
                ),
              getCandidateEvidenceByIds: (ids) =>
                (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<any[]>)(
                  anyApi.library.getCandidateEvidenceByIds,
                  {
                    ids: ids as never
                  }
                )
            }
          ),
        graphDependencies: {
          runners
        }
      }
    );

    const createdAt = Date.now();
    const generationDocument = buildGenerationRunDocument({
      candidateId: args.candidateId,
      jobInput: parsedJobInput,
      result,
      createdAt
    });

    const generationRunId = await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<string>)(
      internal.generate.insertGenerationRunRecord,
      {
        document: generationDocument
      }
    );

    return {
      generationRunId: String(generationRunId),
      candidateSnapshot: generationDocument.candidateSnapshot,
      jobInput: generationDocument.jobInput,
      finalProposal: result.finalProposal,
      approvalStatus: result.approvalStatus,
      critiqueHistory: result.critiqueHistory,
      executionTrace: result.executionTrace,
      stepTelemetry: result.stepTelemetry,
      telemetrySummary: result.telemetrySummary,
      selectedEvidence: result.selectedEvidence,
      retrievedContext: result.retrievedContext,
      jobUnderstanding: result.jobUnderstanding,
      proposalPlan: result.proposalPlan,
      draftHistory: result.draftHistory,
      copyRisk: generationDocument.copyRisk,
      createdAt
    };
  }
});
