import { actionGeneric, anyApi, internalActionGeneric, internalMutationGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { generateEmbeddingWithTelemetry } from "../src/lib/ai/embeddings";
import type { GenerationTelemetrySummary, GenerationStepTelemetry } from "../src/lib/ai/telemetry";
import { createProposalEngineRunners } from "../src/lib/proposal-engine/agents";
import { getProposalEngineStepLabel, type ProposalEngineProgressEvent } from "../src/lib/proposal-engine/progress";
import { generationJobInputSchema, historicalCaseInputSchema, type GenerationJobInput } from "../src/lib/proposal-engine/schemas";
import { runCreateProposal, runRetrieveProposalContext, type CreateProposalResult } from "../src/lib/proposal-engine/service";
import { internal } from "./_generated/api";
import { ingestHistoricalCaseArtifacts, type HistoricalCaseIngestContext } from "./cases";

const generationJobInputValidator = v.object({
  title: v.optional(v.string()),
  description: v.string(),
  proposalQuestions: v.array(
    v.object({
      position: v.float64(),
      prompt: v.string()
    })
  )
});

const proposalQuestionAnswerValidator = v.object({
  position: v.float64(),
  prompt: v.string(),
  answer: v.string()
});

const unresolvedProposalQuestionValidator = v.object({
  position: v.float64(),
  prompt: v.string(),
  reason: v.string()
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

function buildRetrievedContextSnapshot(result: CreateProposalResult) {
  return {
    similarCases: result.retrievedContext.similarCases.map((item) => ({
      _id: item._id,
      clusterId: item.clusterId ?? null,
      candidateId: item.candidateId,
      canonical: item.canonical,
      jobTitle: item.jobTitle,
      jobExtract: {
        projectType: item.jobExtract.projectType,
        domain: item.jobExtract.domain,
        requiredSkills: item.jobExtract.requiredSkills,
        optionalSkills: item.jobExtract.optionalSkills,
        stack: item.jobExtract.stack,
        clientNeeds: item.jobExtract.clientNeeds,
        summary: item.jobExtract.summary
      },
      proposalExtract: {
        hook: item.proposalExtract.hook,
        valueProposition: item.proposalExtract.valueProposition,
        proofPoints: item.proposalExtract.proofPoints,
        tone: item.proposalExtract.tone
      },
      quality: item.quality,
      outcome: item.outcome,
      finalScore: (item as { finalScore?: number }).finalScore,
      semanticScore: (item as { semanticScore?: number }).semanticScore
    })),
    fragments: {
      openings: result.retrievedContext.fragments.openings.map((item) => ({
        _id: item._id,
        clusterId: item.clusterId ?? null,
        candidateId: item.candidateId,
        fragmentType: item.fragmentType,
        text: item.text,
        tags: item.tags,
        specificityScore: item.specificityScore,
        genericnessScore: item.genericnessScore,
        qualityScore: item.qualityScore,
        retrievalEligible: item.retrievalEligible
      })),
      proofs: result.retrievedContext.fragments.proofs.map((item) => ({
        _id: item._id,
        clusterId: item.clusterId ?? null,
        candidateId: item.candidateId,
        fragmentType: item.fragmentType,
        text: item.text,
        tags: item.tags,
        specificityScore: item.specificityScore,
        genericnessScore: item.genericnessScore,
        qualityScore: item.qualityScore,
        retrievalEligible: item.retrievalEligible
      })),
      closings: result.retrievedContext.fragments.closings.map((item) => ({
        _id: item._id,
        clusterId: item.clusterId ?? null,
        candidateId: item.candidateId,
        fragmentType: item.fragmentType,
        text: item.text,
        tags: item.tags,
        specificityScore: item.specificityScore,
        genericnessScore: item.genericnessScore,
        qualityScore: item.qualityScore,
        retrievalEligible: item.retrievalEligible
      }))
    },
    evidenceCandidates: result.retrievedContext.evidenceCandidates.map((item) => ({
      _id: item._id,
      candidateId: item.candidateId,
      type: item.type,
      text: item.text,
      tags: item.tags,
      techStack: item.techStack,
      domains: item.domains,
      confidence: item.confidence,
      active: item.active,
      source: item.source
    }))
  };
}

type StoredGenerationProgressStep = {
  step: string;
  label: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  attempt: number;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
};

type GenerationActionContext = {
  runMutation: (mutationRef: unknown, mutationArgs: unknown) => Promise<unknown>;
  runQuery: (queryRef: unknown, queryArgs: unknown) => Promise<unknown>;
  vectorSearch: (
    tableName: "historical_cases" | "proposal_fragments" | "candidate_evidence_blocks",
    indexName: string,
    query: {
      vector: number[];
      limit: number;
    }
  ) => Promise<Array<{ _id: string; _score: number }>>;
};

function buildProgressStepRecord(event: ProposalEngineProgressEvent): StoredGenerationProgressStep {
  return {
    step: event.step,
    label: getProposalEngineStepLabel(event.step),
    status: event.status === "completed" ? "COMPLETED" : "RUNNING",
    attempt: event.attempt,
    startedAt: event.startedAt,
    finishedAt: event.finishedAt,
    durationMs: event.durationMs
  } as const;
}

function upsertProgressSteps(
  existingSteps: StoredGenerationProgressStep[],
  nextStep: StoredGenerationProgressStep
) {
  const steps = [...existingSteps];
  const existingIndex = steps.findIndex((step) => step.step === nextStep.step && step.attempt === nextStep.attempt);

  if (existingIndex === -1) {
    steps.push(nextStep);
  } else {
    steps[existingIndex] = {
      ...steps[existingIndex],
      ...nextStep
    };
  }

  return steps.sort((left, right) => left.startedAt - right.startedAt || left.attempt - right.attempt);
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

function normalizeGenerationJobInput(jobInput: GenerationJobInput): GenerationJobInput {
  return {
    ...jobInput,
    proposalQuestions: jobInput.proposalQuestions ?? []
  };
}

export function buildGeneratedProposalLibraryText(
  result: Pick<CreateProposalResult, "finalProposal" | "questionAnswers">
) {
  const coverLetter = result.finalProposal.trim();
  const answeredQuestions = [...result.questionAnswers].sort((left, right) => left.position - right.position);

  if (answeredQuestions.length === 0) {
    return coverLetter;
  }

  const questionAnswerSection = answeredQuestions
    .map((item, index) => `Q${index + 1}: ${item.prompt}\nA${index + 1}: ${item.answer}`)
    .join("\n\n");

  return `${coverLetter}\n\nProposal Questions & Answers\n\n${questionAnswerSection}`;
}

export function buildGeneratedHistoricalCaseInput(args: {
  candidateId: number;
  jobInput: GenerationJobInput;
  result: Pick<CreateProposalResult, "finalProposal" | "questionAnswers" | "jobUnderstanding">;
}) {
  return historicalCaseInputSchema.parse({
    candidateId: args.candidateId,
    jobTitle: args.jobInput.title?.trim() || args.result.jobUnderstanding.jobSummary,
    jobDescription: args.jobInput.description,
    proposalText: buildGeneratedProposalLibraryText(args.result),
    outcome: {}
  });
}

export async function bestEffortAutoAddGeneratedPairToLibrary(
  ctx: HistoricalCaseIngestContext,
  args: {
    candidateId: number;
    jobInput: GenerationJobInput;
    result: CreateProposalResult;
    embeddingModel?: string;
    fastModel?: string;
    reasoningModel?: string;
  }
) {
  try {
    const libraryCaseInput = buildGeneratedHistoricalCaseInput({
      candidateId: args.candidateId,
      jobInput: args.jobInput,
      result: args.result
    });

    const ingestionResult = await ingestHistoricalCaseArtifacts(ctx, {
      ...libraryCaseInput,
      embeddingModel: args.embeddingModel,
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    return {
      status: "INGESTED" as const,
      historicalCaseId: ingestionResult.historicalCaseId
    };
  } catch (error) {
    console.error("Failed to auto-add generated pair to the Library.", {
      candidateId: args.candidateId,
      jobTitle: args.jobInput.title?.trim() || args.result.jobUnderstanding.jobSummary,
      error: error instanceof Error ? error.message : "Unknown library auto-add error"
    });

    return {
      status: "FAILED" as const
    };
  }
}

function buildGenerationProgressDocument(args: {
  candidateId: number;
  jobInput: GenerationJobInput;
  createdAt: number;
}) {
  return {
    candidateId: args.candidateId,
    jobInput: args.jobInput,
    status: "QUEUED" as const,
    steps: [],
    startedAt: args.createdAt,
    updatedAt: args.createdAt
  };
}

function buildGenerationProgressPayload(progress: {
  _id: string;
  candidateId: number;
  jobInput: GenerationJobInput;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  currentStep?: {
    step: string;
    label: string;
    attempt: number;
    startedAt: number;
  } | null;
  steps: StoredGenerationProgressStep[];
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  totalDurationMs?: number;
  errorMessage?: string;
  generationRunId?: string | null;
}) {
  return {
    _id: progress._id,
    candidateId: progress.candidateId,
    jobInput: normalizeGenerationJobInput(progress.jobInput),
    status: progress.status,
    currentStep: progress.currentStep ?? null,
    steps: progress.steps,
    startedAt: progress.startedAt,
    updatedAt: progress.updatedAt,
    completedAt: progress.completedAt,
    totalDurationMs: progress.totalDurationMs,
    errorMessage: progress.errorMessage,
    generationRunId: progress.generationRunId ?? null
  };
}

async function executeProposalGeneration(
  ctx: GenerationActionContext,
  args: {
    candidateId: number;
    jobInput: GenerationJobInput;
    progressId?: unknown;
    maxRevisions?: number;
    embeddingModel?: string;
    fastModel?: string;
    reasoningModel?: string;
  }
) {
  const parsedJobInput = generationJobInputSchema.parse(args.jobInput);
  const runners = createProposalEngineRunners({
    fastModel: args.fastModel,
    reasoningModel: args.reasoningModel
  });

  const onProgress =
    args.progressId === undefined
      ? undefined
      : async (event: ProposalEngineProgressEvent) => {
          await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<true | null>)(
            internal.generate.recordGenerationProgressEvent,
            {
              progressId: args.progressId,
              event
            }
          );
        };

  try {
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
            externalProfiles?: {
              githubUrl?: string;
              websiteUrl?: string;
              portfolioUrl?: string;
            };
            metadata?: {
              externalProfiles?: {
                githubUrl?: string;
                websiteUrl?: string;
                portfolioUrl?: string;
              };
            };
          } | null>)(anyApi.profiles.getCandidateProfileSummary, {
            candidateId
          }).then((profile) =>
            profile
              ? {
                  ...profile,
                  externalProfiles: profile.externalProfiles ?? profile.metadata?.externalProfiles ?? {}
                }
              : null
          ),
        retrieveContext: ({ candidateId, jobUnderstanding, proposalQuestions }) =>
          runRetrieveProposalContext(
            {
              candidateId,
              jobUnderstanding,
              proposalQuestions
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
        },
        onProgress
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

    await bestEffortAutoAddGeneratedPairToLibrary(ctx, {
      candidateId: args.candidateId,
      jobInput: parsedJobInput,
      result,
      embeddingModel: args.embeddingModel,
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    if (args.progressId !== undefined) {
      await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<true | null>)(
        internal.generate.completeGenerationProgress,
        {
          progressId: args.progressId,
          generationRunId: generationRunId as never,
          completedAt: Date.now()
        }
      );
    }

    return {
      generationRunId: String(generationRunId),
      progressId: args.progressId ? String(args.progressId) : undefined,
      candidateSnapshot: generationDocument.candidateSnapshot,
      jobInput: generationDocument.jobInput,
      finalProposal: result.finalProposal,
      coverLetterCharCount: result.coverLetterCharCount,
      questionAnswers: result.questionAnswers,
      unresolvedQuestions: result.unresolvedQuestions,
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
  } catch (error) {
    if (args.progressId !== undefined) {
      const message = error instanceof Error ? error.message : "Unknown generation error";
      await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<true | null>)(
        internal.generate.failGenerationProgress,
        {
          progressId: args.progressId,
          errorMessage: message,
          completedAt: Date.now()
        }
      );
    }

    throw error;
  }
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
    retrievedContextSnapshot: buildRetrievedContextSnapshot(args.result),
    candidateSnapshot: buildCandidateSnapshot(args.result),
    selectedEvidence: args.result.selectedEvidence,
    proposalPlan: args.result.proposalPlan,
    draftHistory: args.result.draftHistory,
    critiqueHistory: args.result.critiqueHistory,
    copyRisk: normalizedCopyRisk,
    stepTelemetry: normalizeStepTelemetry(args.result.stepTelemetry),
    telemetrySummary: normalizeTelemetrySummary(args.result.telemetrySummary),
    finalProposal: args.result.finalProposal,
    coverLetterCharCount: args.result.coverLetterCharCount,
    questionAnswers: args.result.questionAnswers,
    unresolvedQuestions: args.result.unresolvedQuestions,
    approvalStatus: args.result.approvalStatus,
    createdAt: args.createdAt,
    updatedAt: args.createdAt
  };
}

export const createGenerationProgress = mutationGeneric({
  args: {
    candidateId: v.float64(),
    jobInput: generationJobInputValidator
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    return ctx.db.insert(
      "generation_progress",
      buildGenerationProgressDocument({
        candidateId: args.candidateId,
        jobInput: args.jobInput,
        createdAt
      })
    );
  }
});

export const getGenerationProgress = queryGeneric({
  args: {
    id: v.id("generation_progress")
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.id);
    if (!progress) {
      return null;
    }

    return buildGenerationProgressPayload({
      _id: String(progress._id),
      candidateId: progress.candidateId,
      jobInput: progress.jobInput,
      status: progress.status,
      currentStep: progress.currentStep ?? null,
      steps: progress.steps,
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt,
      completedAt: progress.completedAt,
      totalDurationMs: progress.totalDurationMs,
      errorMessage: progress.errorMessage,
      generationRunId: progress.generationRunId ? String(progress.generationRunId) : null
    });
  }
});

export const getGenerationProgressById = queryGeneric({
  args: {
    id: v.string()
  },
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("generation_progress", args.id);
    if (!normalizedId) {
      return null;
    }

    const progress = await ctx.db.get(normalizedId);
    if (!progress) {
      return null;
    }

    return buildGenerationProgressPayload({
      _id: String(progress._id),
      candidateId: progress.candidateId,
      jobInput: progress.jobInput,
      status: progress.status,
      currentStep: progress.currentStep ?? null,
      steps: progress.steps,
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt,
      completedAt: progress.completedAt,
      totalDurationMs: progress.totalDurationMs,
      errorMessage: progress.errorMessage,
      generationRunId: progress.generationRunId ? String(progress.generationRunId) : null
    });
  }
});

export const startProposalGeneration = mutationGeneric({
  args: {
    candidateId: v.float64(),
    jobInput: generationJobInputValidator,
    maxRevisions: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const progressId = await ctx.db.insert(
      "generation_progress",
      buildGenerationProgressDocument({
        candidateId: args.candidateId,
        jobInput: args.jobInput,
        createdAt
      })
    );

    await ctx.scheduler.runAfter(0, internal.generate.runProposalForProgress, {
      candidateId: args.candidateId,
      jobInput: args.jobInput,
      progressId,
      maxRevisions: args.maxRevisions,
      embeddingModel: args.embeddingModel,
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    return {
      progressId: String(progressId)
    };
  }
});

export const recordGenerationProgressEvent = internalMutationGeneric({
  args: {
    progressId: v.id("generation_progress"),
    event: v.object({
      step: v.string(),
      status: v.union(v.literal("started"), v.literal("completed")),
      attempt: v.float64(),
      startedAt: v.float64(),
      finishedAt: v.optional(v.float64()),
      durationMs: v.optional(v.float64())
    })
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) {
      return null;
    }

    const nextStep = buildProgressStepRecord(args.event);
    const now = Date.now();

    await ctx.db.patch(args.progressId, {
      status: "RUNNING",
      currentStep:
        args.event.status === "started"
          ? {
              step: nextStep.step,
              label: nextStep.label,
              attempt: nextStep.attempt,
              startedAt: nextStep.startedAt
            }
          : undefined,
      steps: upsertProgressSteps(progress.steps, nextStep),
      updatedAt: now
    });

    return true;
  }
});

export const completeGenerationProgress = internalMutationGeneric({
  args: {
    progressId: v.id("generation_progress"),
    generationRunId: v.id("generation_runs"),
    completedAt: v.float64()
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) {
      return null;
    }

    await ctx.db.patch(args.progressId, {
      status: "COMPLETED",
      currentStep: undefined,
      completedAt: args.completedAt,
      totalDurationMs: args.completedAt - progress.startedAt,
      updatedAt: args.completedAt,
      generationRunId: args.generationRunId,
      errorMessage: undefined
    });

    return true;
  }
});

export const failGenerationProgress = internalMutationGeneric({
  args: {
    progressId: v.id("generation_progress"),
    errorMessage: v.string(),
    completedAt: v.float64()
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) {
      return null;
    }

    const lastCurrentStep = progress.currentStep;
    const nextSteps =
      lastCurrentStep === null || lastCurrentStep === undefined
        ? progress.steps
        : upsertProgressSteps(progress.steps, {
            step: lastCurrentStep.step,
            label: lastCurrentStep.label,
            status: "FAILED",
            attempt: lastCurrentStep.attempt,
            startedAt: lastCurrentStep.startedAt,
            finishedAt: args.completedAt,
            durationMs: args.completedAt - lastCurrentStep.startedAt
          });

    await ctx.db.patch(args.progressId, {
      status: "FAILED",
      currentStep: undefined,
      steps: nextSteps,
      completedAt: args.completedAt,
      totalDurationMs: args.completedAt - progress.startedAt,
      updatedAt: args.completedAt,
      errorMessage: args.errorMessage
    });

    return true;
  }
});

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
      coverLetterCharCount: v.float64(),
      questionAnswers: v.array(proposalQuestionAnswerValidator),
      unresolvedQuestions: v.array(unresolvedProposalQuestionValidator),
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
    progressId: v.optional(v.id("generation_progress")),
    maxRevisions: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return executeProposalGeneration(ctx as unknown as GenerationActionContext, args);
  }
});

export const runProposalForProgress = internalActionGeneric({
  args: {
    candidateId: v.float64(),
    jobInput: generationJobInputValidator,
    progressId: v.id("generation_progress"),
    maxRevisions: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await executeProposalGeneration(ctx as unknown as GenerationActionContext, args);
    return null;
  }
});
