import { actionGeneric, anyApi, internalMutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { createOpenAIAgentRunners } from "../src/lib/ai/agents";
import { generateEmbedding } from "../src/lib/ai/embeddings";
import { runProposalGraph } from "../src/lib/ai/graph";
import { normalizeJobDescription } from "../src/lib/ai/job-description-normalizer";
import type { AnalyzerOutput } from "../src/lib/ai/schemas";
import {
  createInitialState,
  defaultMaxRevisions,
  type ProposalGraphState,
  type RagContextItem
} from "../src/lib/ai/state";
import { createProposalEngineV2Runners } from "../src/lib/ai/v2/agents";
import { generationJobInputSchema } from "../src/lib/ai/v2/schemas";
import { runCreateProposalV2, runRetrieveProposalContextV2 } from "../src/lib/ai/v2/service";
import { internal } from "./_generated/api";

export interface CreateProposalArgs {
  newJobDescription: string;
  preferredMemberId?: number;
  maxRevisions?: number;
  embeddingModel?: string;
  fastModel?: string;
  reasoningModel?: string;
  chatModel?: string;
}

export interface CreateProposalResult {
  finalProposal: string;
  criticStatus: "APPROVED" | "NEEDS_REVISION";
  critiquePoints?: string[];
  executionTrace: string[];
  state: ProposalGraphState;
}

interface RetrievedRawJob {
  _id: string;
  text: string;
  title: string;
  techStack: string[];
}

interface RetrievedProposal {
  _id: string;
  text: string;
  styleProfileId: string;
}

interface RetrievedStyleProfile {
  _id: string;
  writingStyleAnalysis: {
    formality: number;
    enthusiasm: number;
    keyVocabulary: string[];
    sentenceStructure: string;
  };
}

export interface RetrieveRagContextArgs {
  newJobDescription: string;
  limit?: number;
}

export interface RetrieveRagContextDependencies {
  embed: (input: string) => Promise<number[]>;
  vectorSearch: (embedding: number[], limit: number) => Promise<Array<{ _id: string; _score: number }>>;
  getRawJob: (rawJobId: string) => Promise<RetrievedRawJob | null>;
  getProposalByRawJobId: (rawJobId: string) => Promise<RetrievedProposal | null>;
  getStyleProfileById: (styleProfileId: string) => Promise<RetrievedStyleProfile | null>;
}

function clampRagLimit(limit?: number): number {
  return Math.max(1, Math.min(limit ?? 3, 3));
}

export async function runRetrieveRagContext(
  args: RetrieveRagContextArgs,
  dependencies: RetrieveRagContextDependencies
): Promise<RagContextItem[]> {
  const limit = clampRagLimit(args.limit);
  const embedding = await dependencies.embed(args.newJobDescription);
  const vectorMatches = (await dependencies.vectorSearch(embedding, limit)).slice(0, limit);
  const ragItems: RagContextItem[] = [];

  for (const match of vectorMatches) {
    const rawJob = await dependencies.getRawJob(match._id);
    if (!rawJob) {
      continue;
    }

    const proposal = await dependencies.getProposalByRawJobId(rawJob._id);
    if (!proposal) {
      continue;
    }

    const styleProfile = await dependencies.getStyleProfileById(proposal.styleProfileId);
    if (!styleProfile) {
      continue;
    }

    ragItems.push({
      rawJobId: rawJob._id,
      proposalId: proposal._id,
      styleProfileId: styleProfile._id,
      jobTitle: rawJob.title,
      jobText: rawJob.text,
      proposalText: proposal.text,
      techStack: rawJob.techStack,
      styleProfile: {
        formality: styleProfile.writingStyleAnalysis.formality,
        enthusiasm: styleProfile.writingStyleAnalysis.enthusiasm,
        keyVocabulary: styleProfile.writingStyleAnalysis.keyVocabulary,
        sentenceStructure: styleProfile.writingStyleAnalysis.sentenceStructure
      },
      similarity: match._score
    });
  }

  return ragItems;
}

export interface CreateProposalDependencies {
  retrieveRagContext: (args: RetrieveRagContextArgs) => Promise<RagContextItem[]>;
  getGlobalStyleProfile: () => Promise<AnalyzerOutput | null>;
  getPreferredAuthorName?: () => Promise<string | null>;
  runGraph: (initialState: ProposalGraphState) => Promise<ProposalGraphState>;
}

function uniquePreserveOrder(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const cleaned = value.trim();
    if (!cleaned) {
      continue;
    }
    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    result.push(cleaned);
  }

  return result;
}

function mergeStyleProfileWithRagTechStack(
  styleProfile: AnalyzerOutput,
  ragContext: RagContextItem[]
): AnalyzerOutput {
  const ragTechStack = uniquePreserveOrder(ragContext.flatMap((item) => item.techStack ?? []));

  if (styleProfile.tech_stack.length > 0 || ragTechStack.length === 0) {
    return styleProfile;
  }

  return {
    ...styleProfile,
    tech_stack: ragTechStack
  };
}

export async function runCreateProposal(
  args: CreateProposalArgs,
  dependencies: CreateProposalDependencies
): Promise<CreateProposalResult> {
  const normalizedDescription = normalizeJobDescription(args.newJobDescription);
  if (normalizedDescription.metadata.wasTruncated) {
    console.warn(
      `[generate.createProposal] Truncated job description from ${normalizedDescription.metadata.originalLength} to ${normalizedDescription.metadata.finalLength} chars.`
    );
  }

  const ragContext = await dependencies.retrieveRagContext({
    newJobDescription: normalizedDescription.text,
    limit: 3
  });

  const baseStyleProfile = await dependencies.getGlobalStyleProfile();
  if (!baseStyleProfile) {
    throw new Error("No style profile found for proposal generation.");
  }
  const preferredAuthorName = (await dependencies.getPreferredAuthorName?.())?.trim() || null;

  const initialState: ProposalGraphState = {
    ...createInitialState(normalizedDescription.text),
    authorName: preferredAuthorName,
    ragContext,
    styleProfile: mergeStyleProfileWithRagTechStack(baseStyleProfile, ragContext),
    maxRevisions: args.maxRevisions ?? defaultMaxRevisions
  };

  const state = await dependencies.runGraph(initialState);
  const criticStatus = state.criticFeedback?.status ?? "NEEDS_REVISION";

  return {
    finalProposal: state.proposalDraft,
    criticStatus,
    critiquePoints: state.criticFeedback?.critique_points ?? undefined,
    executionTrace: state.executionTrace,
    state
  };
}

export const getRawJobById = queryGeneric({
  args: {
    rawJobId: v.id("raw_jobs")
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.rawJobId);
    if (!doc) {
      return null;
    }

    return {
      _id: String(doc._id),
      text: doc.text,
      title: doc.title,
      techStack: doc.techStack
    };
  }
});

export const getLatestProposalByRawJobId = queryGeneric({
  args: {
    rawJobId: v.id("raw_jobs")
  },
  handler: async (ctx, args) => {
    const proposals = await ctx.db
      .query("processed_proposals")
      .withIndex("by_raw_job_id", (query) => query.eq("rawJobId", args.rawJobId))
      .order("desc")
      .take(1);
    const proposal = proposals[0];
    if (!proposal) {
      return null;
    }

    return {
      _id: String(proposal._id),
      text: proposal.text,
      styleProfileId: String(proposal.styleProfileId)
    };
  }
});

export const getStyleProfileById = queryGeneric({
  args: {
    styleProfileId: v.id("style_profiles")
  },
  handler: async (ctx, args) => {
    const styleProfile = await ctx.db.get(args.styleProfileId);
    if (!styleProfile) {
      return null;
    }

    return {
      _id: String(styleProfile._id),
      writingStyleAnalysis: styleProfile.writingStyleAnalysis
    };
  }
});

export const getLatestGlobalStyleProfile = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const styleProfiles = await ctx.db
      .query("style_profiles")
      .withIndex("by_created_at")
      .order("desc")
      .take(1);

    const latestStyleProfile = styleProfiles[0];
    if (!latestStyleProfile) {
      return null;
    }

    return {
      tech_stack: [],
      writing_style_analysis: {
        formality: latestStyleProfile.writingStyleAnalysis.formality,
        enthusiasm: latestStyleProfile.writingStyleAnalysis.enthusiasm,
        key_vocabulary: latestStyleProfile.writingStyleAnalysis.keyVocabulary,
        sentence_structure: latestStyleProfile.writingStyleAnalysis.sentenceStructure
      },
      project_constraints: []
    } satisfies AnalyzerOutput;
  }
});

export const getLatestPreferredAuthorName = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const styleProfiles = await ctx.db
      .query("style_profiles")
      .withIndex("by_created_at")
      .order("desc")
      .take(1);

    const latestStyleProfile = styleProfiles[0];
    if (!latestStyleProfile) {
      return null;
    }

    const name = latestStyleProfile.memberName?.trim();
    return name ? name : null;
  }
});

export const getLatestStyleProfileByMemberId = queryGeneric({
  args: {
    memberId: v.float64()
  },
  handler: async (ctx, args) => {
    const styleProfiles = await ctx.db
      .query("style_profiles")
      .withIndex("by_member_id", (query) => query.eq("memberId", args.memberId))
      .order("desc")
      .take(1);

    const latestStyleProfile = styleProfiles[0];
    if (!latestStyleProfile) {
      return null;
    }

    return {
      tech_stack: [],
      writing_style_analysis: {
        formality: latestStyleProfile.writingStyleAnalysis.formality,
        enthusiasm: latestStyleProfile.writingStyleAnalysis.enthusiasm,
        key_vocabulary: latestStyleProfile.writingStyleAnalysis.keyVocabulary,
        sentence_structure: latestStyleProfile.writingStyleAnalysis.sentenceStructure
      },
      project_constraints: []
    } satisfies AnalyzerOutput;
  }
});

export const getLatestPreferredAuthorNameByMemberId = queryGeneric({
  args: {
    memberId: v.float64()
  },
  handler: async (ctx, args) => {
    const styleProfiles = await ctx.db
      .query("style_profiles")
      .withIndex("by_member_id", (query) => query.eq("memberId", args.memberId))
      .order("desc")
      .take(1);

    const latestStyleProfile = styleProfiles[0];
    if (!latestStyleProfile) {
      return null;
    }

    const name = latestStyleProfile.memberName?.trim();
    return name ? name : null;
  }
});

export const createProposal = actionGeneric({
  args: {
    newJobDescription: v.string(),
    preferredMemberId: v.optional(v.float64()),
    maxRevisions: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string()),
    chatModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const runners = createOpenAIAgentRunners({
      fastModel: args.fastModel ?? args.chatModel,
      reasoningModel: args.reasoningModel ?? args.chatModel
    });

    return runCreateProposal(args, {
      retrieveRagContext: (retrieveArgs) =>
        runRetrieveRagContext(retrieveArgs, {
          embed: (input) =>
            generateEmbedding(input, {
              model: args.embeddingModel
            }),
          vectorSearch: async (embedding, limit) => {
            const results = await ctx.vectorSearch("raw_jobs", "by_embedding", {
              vector: embedding,
              limit
            });
            return results.map((result) => ({
              _id: String(result._id),
              _score: result._score
            }));
          },
          getRawJob: async (rawJobId) => {
            return (ctx.runQuery as (query: unknown, args: unknown) => Promise<RetrievedRawJob | null>)(
              anyApi.generate.getRawJobById,
              {
                rawJobId: rawJobId as never
              }
            );
          },
          getProposalByRawJobId: async (rawJobId) => {
            return (ctx.runQuery as (query: unknown, args: unknown) => Promise<RetrievedProposal | null>)(
              anyApi.generate.getLatestProposalByRawJobId,
              {
                rawJobId: rawJobId as never
              }
            );
          },
          getStyleProfileById: async (styleProfileId) => {
            return (ctx.runQuery as (query: unknown, args: unknown) => Promise<RetrievedStyleProfile | null>)(
              anyApi.generate.getStyleProfileById,
              {
                styleProfileId: styleProfileId as never
              }
            );
          }
        }),
      getGlobalStyleProfile: () =>
        args.preferredMemberId
          ? (ctx.runQuery as (query: unknown, args: unknown) => Promise<AnalyzerOutput | null>)(
              anyApi.generate.getLatestStyleProfileByMemberId,
              {
                memberId: args.preferredMemberId
              }
            )
          : (ctx.runQuery as (query: unknown, args: unknown) => Promise<AnalyzerOutput | null>)(
              anyApi.generate.getLatestGlobalStyleProfile,
              {}
            ),
      getPreferredAuthorName: () =>
        args.preferredMemberId
          ? (ctx.runQuery as (query: unknown, args: unknown) => Promise<string | null>)(
              anyApi.generate.getLatestPreferredAuthorNameByMemberId,
              {
                memberId: args.preferredMemberId
              }
            )
          : (ctx.runQuery as (query: unknown, args: unknown) => Promise<string | null>)(
              anyApi.generate.getLatestPreferredAuthorName,
              {}
            ),
      runGraph: (initialState) =>
        runProposalGraph(initialState, {
          writer: {
            writer: runners.writer
          },
          critic: {
            critic: runners.critic
          }
        })
    });
  }
});

// Backward compatible alias kept for existing callers.
export const generateProposal = createProposal;

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

export const insertGenerationRunV2Record = internalMutationGeneric({
  args: {
    document: v.object({
      candidateId: v.float64(),
      jobInput: generationJobInputValidator,
      jobUnderstanding: jobUnderstandingValidator,
      retrievedCaseIds: v.array(v.id("historical_cases")),
      retrievedFragmentIds: v.array(v.id("proposal_fragments")),
      retrievedEvidenceIds: v.array(v.id("candidate_evidence_blocks")),
      selectedEvidence: v.array(selectedEvidenceValidator),
      proposalPlan: proposalPlanValidator,
      draftHistory: v.array(v.string()),
      critiqueHistory: v.array(draftCritiqueValidator),
      copyRisk: copyRiskValidator,
      finalProposal: v.string(),
      approvalStatus: v.union(v.literal("APPROVED"), v.literal("NEEDS_REVISION")),
      createdAt: v.float64(),
      updatedAt: v.float64()
    })
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("generation_runs_v2", args.document);
  }
});

export const createProposalV2 = actionGeneric({
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
    const runners = createProposalEngineV2Runners({
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    const result = await runCreateProposalV2(
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
          runRetrieveProposalContextV2(
            {
              candidateId,
              jobUnderstanding
            },
            {
              embed: (input) =>
                generateEmbedding(input, {
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
    const retrievedFragmentIds = [
      ...result.retrievedContext.fragments.openings.map((item) => item._id),
      ...result.retrievedContext.fragments.proofs.map((item) => item._id),
      ...result.retrievedContext.fragments.closings.map((item) => item._id)
    ];

    const generationRunId = await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<string>)(
      internal.generate.insertGenerationRunV2Record,
      {
        document: {
          candidateId: args.candidateId,
          jobInput: parsedJobInput,
          jobUnderstanding: result.jobUnderstanding,
          retrievedCaseIds: result.retrievedContext.similarCases.map((item) => item._id as never),
          retrievedFragmentIds: retrievedFragmentIds as never,
          retrievedEvidenceIds: result.retrievedContext.evidenceCandidates.map((item) => item._id as never),
          selectedEvidence: result.selectedEvidence,
          proposalPlan: result.proposalPlan,
          draftHistory: result.draftHistory,
          critiqueHistory: result.critiqueHistory,
          copyRisk: result.copyRisk ?? {
            triggered: false,
            maxParagraphCosine: 0,
            trigramOverlap: 0,
            matchedCaseIds: [],
            matchedFragmentIds: [],
            reasons: []
          },
          finalProposal: result.finalProposal,
          approvalStatus: result.approvalStatus,
          createdAt,
          updatedAt: createdAt
        }
      }
    );

    return {
      generationRunId: String(generationRunId),
      finalProposal: result.finalProposal,
      approvalStatus: result.approvalStatus,
      critiqueHistory: result.critiqueHistory,
      executionTrace: result.executionTrace,
      selectedEvidence: result.selectedEvidence,
      retrievedContext: result.retrievedContext,
      jobUnderstanding: result.jobUnderstanding,
      proposalPlan: result.proposalPlan,
      draftHistory: result.draftHistory,
      copyRisk: result.copyRisk
    };
  }
});
