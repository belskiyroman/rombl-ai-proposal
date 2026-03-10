import { actionGeneric, anyApi, internalMutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { generateEmbedding } from "../src/lib/ai/embeddings";
import {
  buildCaseQualityPrompt,
  buildJobExtractPrompt,
  buildProposalExtractPrompt,
  createProposalEngineV2Runners
} from "../src/lib/ai/v2/agents";
import {
  createProposalFragments,
  decideClusterForProposal,
  deriveSeedEvidenceBlocks,
  normalizeHistoricalCase
} from "../src/lib/ai/v2/offline";
import {
  historicalCaseInputSchema,
  type CandidateProfileInput,
  type HistoricalCaseInput
} from "../src/lib/ai/v2/schemas";
import { buildNeedsVectorText } from "../src/lib/ai/v2/service";
import { qualitySelectionScore } from "../src/lib/ai/v2/similarity";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const caseSourceValidator = v.union(v.literal("manual"), v.literal("backfill"));
const toneProfileValidator = v.union(
  v.literal("concise"),
  v.literal("consultative"),
  v.literal("confident"),
  v.literal("technical"),
  v.literal("founder-like")
);
const evidenceTypeValidator = v.union(
  v.literal("project"),
  v.literal("responsibility"),
  v.literal("tech"),
  v.literal("impact"),
  v.literal("domain"),
  v.literal("achievement")
);
const fragmentTypeValidator = v.union(v.literal("opening"), v.literal("proof"), v.literal("closing"));

const historicalCaseDocumentValidator = v.object({
  candidateId: v.float64(),
  source: caseSourceValidator,
  jobTitle: v.string(),
  rawJobDescription: v.string(),
  rawProposalText: v.string(),
  normalizedJobDescription: v.string(),
  normalizedProposalText: v.string(),
  jobExtract: v.object({
    projectType: v.string(),
    domain: v.string(),
    requiredSkills: v.array(v.string()),
    optionalSkills: v.array(v.string()),
    senioritySignals: v.array(v.string()),
    deliverables: v.array(v.string()),
    constraints: v.array(v.string()),
    stack: v.array(v.string()),
    softSignals: v.array(v.string()),
    jobLengthBucket: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    clientNeeds: v.array(v.string()),
    summary: v.string()
  }),
  proposalExtract: v.object({
    hook: v.string(),
    valueProposition: v.string(),
    experienceClaims: v.array(v.string()),
    techMapping: v.array(v.string()),
    proofPoints: v.array(v.string()),
    cta: v.string(),
    tone: toneProfileValidator,
    lengthBucket: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    specificityScore: v.float64(),
    genericnessScore: v.float64()
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
  outcome: v.object({
    reply: v.optional(v.boolean()),
    interview: v.optional(v.boolean()),
    hired: v.optional(v.boolean())
  }),
  clusterId: v.optional(v.id("proposal_clusters")),
  canonical: v.boolean(),
  domain: v.string(),
  projectType: v.string(),
  rawJobEmbedding: v.array(v.float64()),
  jobSummaryEmbedding: v.array(v.float64()),
  needsEmbedding: v.array(v.float64()),
  legacyRawJobId: v.optional(v.string()),
  legacyProcessedProposalId: v.optional(v.string()),
  legacyStyleProfileId: v.optional(v.string()),
  createdAt: v.float64(),
  updatedAt: v.float64()
});

const proposalClusterDocumentValidator = v.object({
  candidateId: v.float64(),
  representativeCaseId: v.optional(v.id("historical_cases")),
  clusterSize: v.float64(),
  centroidFingerprint: v.string(),
  qualityScore: v.float64(),
  duplicateMethod: v.string(),
  createdAt: v.float64(),
  updatedAt: v.float64()
});

const proposalFragmentDocumentValidator = v.object({
  candidateId: v.float64(),
  caseId: v.id("historical_cases"),
  clusterId: v.optional(v.id("proposal_clusters")),
  fragmentType: fragmentTypeValidator,
  text: v.string(),
  tags: v.array(v.string()),
  specificityScore: v.float64(),
  genericnessScore: v.float64(),
  qualityScore: v.float64(),
  retrievalEligible: v.boolean(),
  embedding: v.array(v.float64()),
  createdAt: v.float64(),
  updatedAt: v.float64()
});

const caseEvidenceDocumentValidator = v.object({
  candidateId: v.float64(),
  source: v.literal("case_inference"),
  sourceCaseId: v.optional(v.id("historical_cases")),
  type: evidenceTypeValidator,
  text: v.string(),
  tags: v.array(v.string()),
  structured: v.object({
    title: v.optional(v.string()),
    techStack: v.array(v.string()),
    domains: v.array(v.string()),
    impactSummary: v.optional(v.string())
  }),
  confidence: v.float64(),
  active: v.boolean(),
  embedding: v.array(v.float64()),
  createdAt: v.float64(),
  updatedAt: v.float64()
});

interface CanonicalCaseRecord {
  _id: Id<"historical_cases">;
  clusterId: Id<"proposal_clusters">;
  normalizedProposalText: string;
  quality: {
    specificityScore: number;
    genericnessScore: number;
  };
  outcome: {
    reply?: boolean;
    interview?: boolean;
    hired?: boolean;
  };
}

export const getCanonicalCasesForCandidate = queryGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const cases = await ctx.db
      .query("historical_cases")
      .withIndex("by_candidate_id_and_canonical", (query) => query.eq("candidateId", args.candidateId))
      .collect();

    return cases
      .filter((record) => record.clusterId && record.canonical)
      .map((record) => ({
        _id: record._id,
        clusterId: record.clusterId as Id<"proposal_clusters">,
        normalizedProposalText: record.normalizedProposalText,
        quality: {
          specificityScore: record.quality.specificityScore,
          genericnessScore: record.quality.genericnessScore
        },
        outcome: record.outcome
      }));
  }
});

export const getHistoricalCaseByLegacyProcessedProposalId = queryGeneric({
  args: {
    legacyProcessedProposalId: v.string()
  },
  handler: async (ctx, args) => {
    const existingCases = await ctx.db
      .query("historical_cases")
      .withIndex("by_created_at")
      .collect();

    const match = existingCases.find(
      (record) => record.legacyProcessedProposalId === args.legacyProcessedProposalId
    );

    return match ? { _id: String(match._id), canonical: match.canonical } : null;
  }
});

export const getBackfillSourceRecords = queryGeneric({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 200, 1000));
    const processedProposals = await ctx.db
      .query("processed_proposals")
      .withIndex("by_created_at")
      .order("asc")
      .take(limit);

    const rawJobs = await Promise.all(processedProposals.map((proposal) => ctx.db.get(proposal.rawJobId)));
    const styleProfiles = await Promise.all(processedProposals.map((proposal) => ctx.db.get(proposal.styleProfileId)));

    return processedProposals
      .map((proposal, index) => {
        const rawJob = rawJobs[index];
        const styleProfile = styleProfiles[index];
        if (!rawJob || !styleProfile) {
          return null;
        }

        return {
          processedProposalId: String(proposal._id),
          rawJobId: String(rawJob._id),
          styleProfileId: String(styleProfile._id),
          candidateId: proposal.memberId,
          memberName: styleProfile.memberName,
          memberLocation: styleProfile.memberLocation,
          talentBadge: styleProfile.talentBadge,
          jobTitle: rawJob.title,
          jobDescription: rawJob.text,
          proposalText: proposal.text,
          outcome: {
            reply: proposal.viewed,
            interview: proposal.interview,
            hired: proposal.offer
          },
          styleHints: {
            keyVocabulary: styleProfile.keyVocabulary,
            sentenceStructure: styleProfile.sentenceStructure
          }
        };
      })
      .filter((record): record is NonNullable<typeof record> => record !== null);
  }
});

export const insertProposalClusterRecord = internalMutationGeneric({
  args: {
    document: proposalClusterDocumentValidator
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("proposal_clusters", args.document);
  }
});

export const updateProposalClusterRecord = internalMutationGeneric({
  args: {
    clusterId: v.id("proposal_clusters"),
    patch: v.object({
      representativeCaseId: v.optional(v.id("historical_cases")),
      clusterSize: v.float64(),
      centroidFingerprint: v.string(),
      qualityScore: v.float64(),
      duplicateMethod: v.string(),
      updatedAt: v.float64()
    })
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clusterId, args.patch);
    return args.clusterId;
  }
});

export const insertHistoricalCaseRecord = internalMutationGeneric({
  args: {
    document: historicalCaseDocumentValidator
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("historical_cases", args.document);
  }
});

export const updateHistoricalCaseCanonical = internalMutationGeneric({
  args: {
    caseId: v.id("historical_cases"),
    canonical: v.boolean(),
    updatedAt: v.float64()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.caseId, {
      canonical: args.canonical,
      updatedAt: args.updatedAt
    });

    return args.caseId;
  }
});

export const insertProposalFragments = internalMutationGeneric({
  args: {
    documents: v.array(proposalFragmentDocumentValidator)
  },
  handler: async (ctx, args) => {
    const inserted = [];

    for (const document of args.documents) {
      inserted.push(await ctx.db.insert("proposal_fragments", document));
    }

    return inserted;
  }
});

export const updateProposalFragmentsEligibilityByCaseId = internalMutationGeneric({
  args: {
    caseId: v.id("historical_cases"),
    retrievalEligible: v.boolean(),
    updatedAt: v.float64()
  },
  handler: async (ctx, args) => {
    const fragments = await ctx.db
      .query("proposal_fragments")
      .withIndex("by_case_id", (query) => query.eq("caseId", args.caseId))
      .collect();

    for (const fragment of fragments) {
      await ctx.db.patch(fragment._id, {
        retrievalEligible: args.retrievalEligible,
        updatedAt: args.updatedAt
      });
    }

    return fragments.length;
  }
});

export const insertCaseEvidenceBlocks = internalMutationGeneric({
  args: {
    documents: v.array(caseEvidenceDocumentValidator)
  },
  handler: async (ctx, args) => {
    const inserted = [];

    for (const document of args.documents) {
      inserted.push(await ctx.db.insert("candidate_evidence_blocks", document));
    }

    return inserted;
  }
});

export const updateCaseEvidenceActiveByCaseId = internalMutationGeneric({
  args: {
    caseId: v.id("historical_cases"),
    active: v.boolean(),
    updatedAt: v.float64()
  },
  handler: async (ctx, args) => {
    const evidenceBlocks = await ctx.db
      .query("candidate_evidence_blocks")
      .withIndex("by_source_case_id", (query) => query.eq("sourceCaseId", args.caseId))
      .collect();

    for (const block of evidenceBlocks) {
      await ctx.db.patch(block._id, {
        active: args.active,
        updatedAt: args.updatedAt
      });
    }

    return evidenceBlocks.length;
  }
});

type CasesActionCtx = ActionCtx;

async function ensureCandidateProfile(ctx: CasesActionCtx, profile: CandidateProfileInput) {
  const createdAt = Date.now();

  return ctx.runMutation(
    internal.profiles.upsertCandidateProfileRecord,
    {
      document: {
        ...profile,
        createdAt,
        updatedAt: createdAt
      }
    }
  );
}

async function ingestHistoricalCaseCore(
  ctx: CasesActionCtx,
  args: HistoricalCaseInput & {
    embeddingModel?: string;
    fastModel?: string;
    reasoningModel?: string;
  }
) {
  if (args.source === "backfill" && args.legacyProcessedProposalId) {
    const existing = (await ctx.runQuery(anyApi.cases.getHistoricalCaseByLegacyProcessedProposalId, {
      legacyProcessedProposalId: args.legacyProcessedProposalId
    })) as { _id: string; canonical: boolean } | null;

    if (existing) {
      return {
        historicalCaseId: existing._id,
        clusterId: null,
        canonical: existing.canonical,
        fragmentIds: [],
        evidenceIds: [],
        jobExtract: null,
        proposalExtract: null,
        quality: null
      };
    }
  }

  const createdAt = Date.now();
  const runners = createProposalEngineV2Runners({
    fastModel: args.fastModel,
    reasoningModel: args.reasoningModel
  });
  const normalized = normalizeHistoricalCase(args.jobDescription, args.proposalText);
  const jobExtract = await runners.extractJob.invoke(
    buildJobExtractPrompt({
      jobTitle: args.jobTitle,
      jobDescription: normalized.normalizedJobDescription
    })
  );
  const proposalExtract = await runners.extractProposal.invoke(
    buildProposalExtractPrompt({
      proposalText: normalized.normalizedProposalText,
      relatedJobSummary: jobExtract.summary
    })
  );
  const quality = await runners.scoreCaseQuality.invoke(
    buildCaseQualityPrompt({
      jobExtract,
      proposalExtract,
      proposalText: normalized.normalizedProposalText
    })
  );

  const [rawJobEmbedding, jobSummaryEmbedding, needsEmbedding, canonicalCases] = await Promise.all([
    generateEmbedding(normalized.normalizedJobDescription, {
      model: args.embeddingModel
    }),
    generateEmbedding(jobExtract.summary, {
      model: args.embeddingModel
    }),
    generateEmbedding(
      buildNeedsVectorText({
        jobSummary: jobExtract.summary,
        clientNeeds: jobExtract.clientNeeds,
        mustHaveSkills: jobExtract.requiredSkills,
        niceToHaveSkills: jobExtract.optionalSkills,
        projectRiskFlags: jobExtract.constraints,
        proposalStrategy: {
          tone: proposalExtract.tone,
          length: proposalExtract.lengthBucket,
          focus: jobExtract.clientNeeds.slice(0, 3)
        }
      }),
      {
        model: args.embeddingModel
      }
    ),
    ctx.runQuery(anyApi.cases.getCanonicalCasesForCandidate, {
      candidateId: args.candidateId
    }) as Promise<CanonicalCaseRecord[]>
  ]);

  const clusterDecision = decideClusterForProposal(
    normalized.normalizedProposalText,
    {
      specificityScore: quality.specificityScore,
      genericnessScore: quality.genericnessScore
    },
    args.outcome,
    canonicalCases.map((record) => ({
      id: String(record._id),
      clusterId: String(record.clusterId),
      normalizedProposalText: record.normalizedProposalText,
      quality: record.quality,
      outcome: record.outcome
    }))
  );

  const matchedRepresentative = clusterDecision.representativeCaseId
    ? canonicalCases.find((record) => String(record._id) === clusterDecision.representativeCaseId)
    : null;

  let clusterRef = matchedRepresentative?.clusterId ?? null;
  if (!clusterRef) {
    clusterRef = (await ctx.runMutation(internal.cases.insertProposalClusterRecord, {
      document: {
        candidateId: args.candidateId,
        representativeCaseId: undefined,
        clusterSize: 0,
        centroidFingerprint: normalized.normalizedProposalText.slice(0, 500),
        qualityScore: qualitySelectionScore(quality),
        duplicateMethod: clusterDecision.duplicateMethod,
        createdAt,
        updatedAt: createdAt
      }
    })) as Id<"proposal_clusters">;
  }

  const historicalCaseId = (await ctx.runMutation(
    internal.cases.insertHistoricalCaseRecord,
    {
      document: {
        candidateId: args.candidateId,
        source: args.source,
        jobTitle: args.jobTitle,
        rawJobDescription: args.jobDescription,
        rawProposalText: args.proposalText,
        normalizedJobDescription: normalized.normalizedJobDescription,
        normalizedProposalText: normalized.normalizedProposalText,
        jobExtract,
        proposalExtract,
        quality,
        outcome: args.outcome,
        clusterId: clusterRef,
        canonical: clusterDecision.newCaseBecomesRepresentative,
        domain: jobExtract.domain,
        projectType: jobExtract.projectType,
        rawJobEmbedding,
        jobSummaryEmbedding,
        needsEmbedding,
        legacyRawJobId: args.legacyRawJobId,
        legacyProcessedProposalId: args.legacyProcessedProposalId,
        legacyStyleProfileId: args.legacyStyleProfileId,
        createdAt,
        updatedAt: createdAt
      }
    }
  )) as Id<"historical_cases">;

  if (matchedRepresentative && clusterDecision.newCaseBecomesRepresentative) {
    await Promise.all([
      ctx.runMutation(internal.cases.updateHistoricalCaseCanonical, {
        caseId: matchedRepresentative._id,
        canonical: false,
        updatedAt: createdAt
      }),
      ctx.runMutation(internal.cases.updateProposalFragmentsEligibilityByCaseId, {
        caseId: matchedRepresentative._id,
        retrievalEligible: false,
        updatedAt: createdAt
      }),
      ctx.runMutation(internal.cases.updateCaseEvidenceActiveByCaseId, {
        caseId: matchedRepresentative._id,
        active: false,
        updatedAt: createdAt
      })
    ]);
  }

  const clusterSize = canonicalCases.filter((record) => String(record.clusterId) === String(clusterRef)).length + 1;
  await ctx.runMutation(internal.cases.updateProposalClusterRecord, {
    clusterId: clusterRef,
    patch: {
      representativeCaseId: clusterDecision.newCaseBecomesRepresentative
        ? historicalCaseId
        : matchedRepresentative?._id,
      clusterSize,
      centroidFingerprint: normalized.normalizedProposalText.slice(0, 500),
      qualityScore: Math.max(
        qualitySelectionScore(quality),
        ...canonicalCases
          .filter((record) => String(record.clusterId) === String(clusterRef))
          .map((record) => 0.5 + record.quality.specificityScore * 0.25 - record.quality.genericnessScore * 0.15),
        0
      ),
      duplicateMethod: clusterDecision.duplicateMethod,
      updatedAt: createdAt
    }
  });

  const fragments = createProposalFragments(proposalExtract, quality);
  const fragmentEmbeddings = await Promise.all(
    fragments.map((fragment) =>
      generateEmbedding(fragment.text, {
        model: args.embeddingModel
      })
    )
  );
  const fragmentIds = (await ctx.runMutation(internal.cases.insertProposalFragments, {
    documents: fragments.map((fragment, index) => ({
      candidateId: args.candidateId,
      caseId: historicalCaseId,
      clusterId: clusterRef,
      fragmentType: fragment.fragmentType,
      text: fragment.text,
      tags: fragment.tags,
      specificityScore: fragment.specificityScore,
      genericnessScore: fragment.genericnessScore,
      qualityScore: fragment.qualityScore,
      retrievalEligible: clusterDecision.newCaseBecomesRepresentative,
      embedding: fragmentEmbeddings[index],
      createdAt,
      updatedAt: createdAt
    }))
  })) as Id<"proposal_fragments">[];

  const evidenceBlocks = deriveSeedEvidenceBlocks(proposalExtract, jobExtract);
  const evidenceEmbeddings = await Promise.all(
    evidenceBlocks.map((block) =>
      generateEmbedding(block.text, {
        model: args.embeddingModel
      })
    )
  );
  const evidenceIds = (await ctx.runMutation(internal.cases.insertCaseEvidenceBlocks, {
    documents: evidenceBlocks.map((block, index) => ({
      candidateId: args.candidateId,
      source: "case_inference" as const,
      sourceCaseId: historicalCaseId,
      type: block.type,
      text: block.text,
      tags: block.tags,
      structured: {
        title: block.title,
        techStack: block.techStack,
        domains: block.domains,
        impactSummary: block.impactSummary
      },
      confidence: 0.82,
      active: clusterDecision.newCaseBecomesRepresentative,
      embedding: evidenceEmbeddings[index],
      createdAt,
      updatedAt: createdAt
    }))
  })) as Id<"candidate_evidence_blocks">[];

  return {
    historicalCaseId: String(historicalCaseId),
    clusterId: String(clusterRef),
    canonical: clusterDecision.newCaseBecomesRepresentative,
    fragmentIds: fragmentIds.map((id) => String(id)),
    evidenceIds: evidenceIds.map((id) => String(id)),
    jobExtract,
    proposalExtract,
    quality
  };
}

export const ingestHistoricalCase = actionGeneric({
  args: {
    candidateId: v.float64(),
    source: v.optional(caseSourceValidator),
    jobTitle: v.string(),
    jobDescription: v.string(),
    proposalText: v.string(),
    outcome: v.optional(
      v.object({
        reply: v.optional(v.boolean()),
        interview: v.optional(v.boolean()),
        hired: v.optional(v.boolean())
      })
    ),
    legacyRawJobId: v.optional(v.string()),
    legacyProcessedProposalId: v.optional(v.string()),
    legacyStyleProfileId: v.optional(v.string()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const parsed = historicalCaseInputSchema.parse({
      candidateId: args.candidateId,
      source: args.source ?? "manual",
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription,
      proposalText: args.proposalText,
      outcome: args.outcome ?? {},
      legacyRawJobId: args.legacyRawJobId,
      legacyProcessedProposalId: args.legacyProcessedProposalId,
      legacyStyleProfileId: args.legacyStyleProfileId
    } satisfies HistoricalCaseInput);

    const profile = await (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<{
      candidateId: number;
    } | null>)(anyApi.profiles.getCandidateProfileSummary, {
      candidateId: parsed.candidateId
    });

    if (!profile) {
      throw new Error(`Candidate profile ${parsed.candidateId} not found. Create it before ingesting historical cases.`);
    }

    return ingestHistoricalCaseCore(ctx, {
      ...parsed,
      embeddingModel: args.embeddingModel,
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });
  }
});

export const backfillFromV1 = actionGeneric({
  args: {
    limit: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const records = await (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<Array<{
      processedProposalId: string;
      rawJobId: string;
      styleProfileId: string;
      candidateId: number;
      memberName: string;
      memberLocation: string;
      talentBadge?: string;
      jobTitle: string;
      jobDescription: string;
      proposalText: string;
      outcome: {
        reply?: boolean;
        interview?: boolean;
        hired?: boolean;
      };
      styleHints: {
        keyVocabulary: string[];
        sentenceStructure: string;
      };
    }>>) (anyApi.cases.getBackfillSourceRecords, {
      limit: args.limit
    });

    const results = [];

    for (const record of records) {
      await ensureCandidateProfile(ctx, {
        candidateId: record.candidateId,
        displayName: record.memberName || `Candidate #${record.candidateId}`,
        positioningSummary: `Experienced freelancer with ${record.styleHints.keyVocabulary.slice(0, 5).join(", ")} and ${record.styleHints.sentenceStructure} communication style.`,
        toneProfile: "consultative",
        coreDomains: [record.memberLocation || "Global"],
        preferredCtaStyle: "Short confident CTA with clear next step.",
        metadata: {
          seniority: record.talentBadge,
          location: record.memberLocation
        }
      });

      results.push(
        await ingestHistoricalCaseCore(ctx, {
          candidateId: record.candidateId,
          source: "backfill",
          jobTitle: record.jobTitle,
          jobDescription: record.jobDescription,
          proposalText: record.proposalText,
          outcome: record.outcome,
          legacyRawJobId: record.rawJobId,
          legacyProcessedProposalId: record.processedProposalId,
          legacyStyleProfileId: record.styleProfileId,
          embeddingModel: args.embeddingModel,
          fastModel: args.fastModel,
          reasoningModel: args.reasoningModel
        })
      );
    }

    return {
      importedCount: results.length,
      canonicalCount: results.filter((result) => result.canonical).length
    };
  }
});
