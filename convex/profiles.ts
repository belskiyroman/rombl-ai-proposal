import { actionGeneric, anyApi, internalMutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { createProposalEngineRunners, buildCandidateEvidencePrompt } from "../src/lib/proposal-engine/agents";
import {
  candidateEvidenceInputSchema,
  candidateProfileInputSchema,
  type CandidateEvidenceInputBlock,
  type CandidateProfileInput
} from "../src/lib/proposal-engine/schemas";
import { generateEmbedding } from "../src/lib/ai/embeddings";
import { internal } from "./_generated/api";

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

const candidateProfileDocumentValidator = v.object({
  candidateId: v.float64(),
  displayName: v.string(),
  positioningSummary: v.string(),
  toneProfile: toneProfileValidator,
  coreDomains: v.array(v.string()),
  preferredCtaStyle: v.string(),
  metadata: v.object({
    seniority: v.optional(v.string()),
    availability: v.optional(v.string()),
    location: v.optional(v.string()),
    notes: v.optional(v.string())
  }),
  createdAt: v.float64(),
  updatedAt: v.float64()
});

const candidateEvidenceDocumentValidator = v.object({
  candidateId: v.float64(),
  source: v.union(v.literal("candidate_profile"), v.literal("case_inference")),
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

export const listCandidateProfiles = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("candidate_profiles").withIndex("by_updated_at").order("desc").collect();

    return profiles.map((profile) => ({
      _id: String(profile._id),
      candidateId: profile.candidateId,
      displayName: profile.displayName,
      toneProfile: profile.toneProfile,
      coreDomains: profile.coreDomains,
      preferredCtaStyle: profile.preferredCtaStyle,
      updatedAt: profile.updatedAt
    }));
  }
});

export const getNextCandidateId = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("candidate_profiles").collect();
    const maxCandidateId = profiles.reduce((max, profile) => Math.max(max, profile.candidateId), 0);

    return maxCandidateId + 1;
  }
});

export const getCandidateProfile = queryGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("candidate_profiles")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .order("desc")
      .take(1);

    const profile = records[0];
    if (!profile) {
      return null;
    }

    const evidenceBlocks = await ctx.db
      .query("candidate_evidence_blocks")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .collect();

    return {
      _id: String(profile._id),
      candidateId: profile.candidateId,
      displayName: profile.displayName,
      positioningSummary: profile.positioningSummary,
      toneProfile: profile.toneProfile,
      coreDomains: profile.coreDomains,
      preferredCtaStyle: profile.preferredCtaStyle,
      metadata: profile.metadata,
      activeEvidenceCount: evidenceBlocks.filter((block) => block.source === "candidate_profile" && block.active).length,
      historicalEvidenceCount: evidenceBlocks.filter((block) => block.source === "case_inference").length,
      updatedAt: profile.updatedAt
    };
  }
});

export const getCandidateProfileSummary = queryGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("candidate_profiles")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .order("desc")
      .take(1);

    const latestProfile = profile[0];
    if (!latestProfile) {
      return null;
    }

    const evidenceBlocks = await ctx.db
      .query("candidate_evidence_blocks")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .collect();

    return {
      _id: String(latestProfile._id),
      candidateId: latestProfile.candidateId,
      displayName: latestProfile.displayName,
      positioningSummary: latestProfile.positioningSummary,
      toneProfile: latestProfile.toneProfile,
      coreDomains: latestProfile.coreDomains,
      preferredCtaStyle: latestProfile.preferredCtaStyle,
      metadata: latestProfile.metadata,
      activeEvidenceCount: evidenceBlocks.filter((block) => block.active).length,
      evidencePreview: evidenceBlocks.slice(0, 4).map((block) => ({
        _id: String(block._id),
        type: block.type,
        text: block.text
      }))
    };
  }
});

export const listCandidateEvidenceBlocks = queryGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("candidate_evidence_blocks")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .collect();

    return blocks
      .filter((block) => block.source === "candidate_profile")
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((block) => ({
        _id: String(block._id),
        candidateId: block.candidateId,
        type: block.type,
        text: block.text,
        tags: block.tags,
        techStack: block.structured.techStack,
        domains: block.structured.domains,
        confidence: block.confidence,
        active: block.active,
        updatedAt: block.updatedAt
      }));
  }
});

export const upsertCandidateProfileRecord = internalMutationGeneric({
  args: {
    document: candidateProfileDocumentValidator
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("candidate_profiles")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.document.candidateId))
      .order("desc")
      .take(1);

    const latest = existing[0];
    if (!latest) {
      return ctx.db.insert("candidate_profiles", args.document);
    }

    await ctx.db.patch(latest._id, {
      displayName: args.document.displayName,
      positioningSummary: args.document.positioningSummary,
      toneProfile: args.document.toneProfile,
      coreDomains: args.document.coreDomains,
      preferredCtaStyle: args.document.preferredCtaStyle,
      metadata: args.document.metadata,
      updatedAt: args.document.updatedAt
    });

    return latest._id;
  }
});

export const replaceCandidateProfileEvidenceBlocks = internalMutationGeneric({
  args: {
    candidateId: v.float64(),
    documents: v.array(candidateEvidenceDocumentValidator)
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("candidate_evidence_blocks")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .collect();

    for (const block of existing) {
      if (block.source === "candidate_profile") {
        await ctx.db.delete(block._id);
      }
    }

    const insertedIds = [];
    for (const document of args.documents) {
      insertedIds.push(await ctx.db.insert("candidate_evidence_blocks", document));
    }

    return insertedIds;
  }
});

export const insertCandidateEvidenceBlocks = internalMutationGeneric({
  args: {
    documents: v.array(candidateEvidenceDocumentValidator)
  },
  handler: async (ctx, args) => {
    const insertedIds = [];

    for (const document of args.documents) {
      insertedIds.push(await ctx.db.insert("candidate_evidence_blocks", document));
    }

    return insertedIds;
  }
});

export const deleteCandidateEvidenceBlockRecord = internalMutationGeneric({
  args: {
    evidenceBlockId: v.id("candidate_evidence_blocks")
  },
  handler: async (ctx, args) => {
    const block = await ctx.db.get(args.evidenceBlockId);
    if (!block) {
      return null;
    }

    if (block.source !== "candidate_profile") {
      return {
        _id: args.evidenceBlockId,
        candidateId: block.candidateId,
        source: block.source,
        deleted: false
      };
    }

    await ctx.db.delete(args.evidenceBlockId);

    return {
      _id: args.evidenceBlockId,
      candidateId: block.candidateId,
      source: block.source,
      deleted: true
    };
  }
});

export const deleteCandidateRecordTree = internalMutationGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const [profiles, evidenceBlocks, fragments, cases, clusters, generationRuns] = await Promise.all([
      ctx.db
        .query("candidate_profiles")
        .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
        .collect(),
      ctx.db
        .query("candidate_evidence_blocks")
        .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
        .collect(),
      ctx.db
        .query("proposal_fragments")
        .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
        .collect(),
      ctx.db
        .query("historical_cases")
        .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
        .collect(),
      ctx.db
        .query("proposal_clusters")
        .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
        .collect(),
      ctx.db
        .query("generation_runs")
        .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
        .collect()
    ]);

    for (const run of generationRuns) {
      await ctx.db.delete(run._id);
    }
    for (const fragment of fragments) {
      await ctx.db.delete(fragment._id);
    }
    for (const evidenceBlock of evidenceBlocks) {
      await ctx.db.delete(evidenceBlock._id);
    }
    for (const record of cases) {
      await ctx.db.delete(record._id);
    }
    for (const cluster of clusters) {
      await ctx.db.delete(cluster._id);
    }
    for (const profile of profiles) {
      await ctx.db.delete(profile._id);
    }

    return {
      deletedProfiles: profiles.length,
      deletedEvidenceBlocks: evidenceBlocks.length,
      deletedFragments: fragments.length,
      deletedHistoricalCases: cases.length,
      deletedClusters: clusters.length,
      deletedGenerationRuns: generationRuns.length
    };
  }
});

function uniqueEvidenceBlocks(blocks: CandidateEvidenceInputBlock[]): CandidateEvidenceInputBlock[] {
  const seen = new Set<string>();
  const result: CandidateEvidenceInputBlock[] = [];

  for (const block of blocks) {
    const key = `${block.type}:${block.text.trim().toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(block);
  }

  return result;
}

async function buildCandidateEvidenceDocuments(args: {
  candidateId: number;
  blocks: CandidateEvidenceInputBlock[];
  source: "candidate_profile" | "case_inference";
  createdAt: number;
  embeddingModel?: string;
}) {
  const uniqueBlocks = uniqueEvidenceBlocks(args.blocks);
  const embeddings = await Promise.all(
    uniqueBlocks.map((block) =>
      generateEmbedding(block.text, {
        model: args.embeddingModel
      })
    )
  );

  return uniqueBlocks.map((block, index) => ({
    candidateId: args.candidateId,
    source: args.source,
    type: block.type,
    text: block.text,
    tags: block.tags,
    structured: {
      title: block.title,
      techStack: block.techStack,
      domains: block.domains,
      impactSummary: block.impactSummary
    },
    confidence: args.source === "candidate_profile" ? 0.95 : 0.8,
    active: true,
    embedding: embeddings[index],
    createdAt: args.createdAt,
    updatedAt: args.createdAt
  }));
}

export const upsertCandidateProfile = actionGeneric({
  args: {
    candidateId: v.float64(),
    displayName: v.string(),
    positioningSummary: v.string(),
    toneProfile: toneProfileValidator,
    coreDomains: v.array(v.string()),
    preferredCtaStyle: v.string(),
    metadata: v.optional(
      v.object({
        seniority: v.optional(v.string()),
        availability: v.optional(v.string()),
        location: v.optional(v.string()),
        notes: v.optional(v.string())
      })
    ),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<{ profileId: string; candidateId: number; evidenceCount: number }> => {
    const parsed = candidateProfileInputSchema.parse({
      candidateId: args.candidateId,
      displayName: args.displayName,
      positioningSummary: args.positioningSummary,
      toneProfile: args.toneProfile,
      coreDomains: args.coreDomains,
      preferredCtaStyle: args.preferredCtaStyle,
      metadata: args.metadata ?? {}
    } satisfies CandidateProfileInput);

    const createdAt = Date.now();
    const runners = createProposalEngineRunners({
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    const extractedEvidence = await runners.extractCandidateEvidence.invoke(
      buildCandidateEvidencePrompt({
        candidateSummary: parsed.positioningSummary,
        displayName: parsed.displayName,
        knownDomains: parsed.coreDomains
      })
    );

    const [profileId, evidenceDocuments]: [string, Awaited<ReturnType<typeof buildCandidateEvidenceDocuments>>] =
      await Promise.all([
      (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<string>)(
        internal.profiles.upsertCandidateProfileRecord,
        {
          document: {
            ...parsed,
            createdAt,
            updatedAt: createdAt
          }
        }
      ),
      buildCandidateEvidenceDocuments({
        candidateId: parsed.candidateId,
        blocks: extractedEvidence.blocks,
        source: "candidate_profile",
        createdAt,
        embeddingModel: args.embeddingModel
      })
      ]);

    await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<string[]>)(
      internal.profiles.replaceCandidateProfileEvidenceBlocks,
      {
        candidateId: parsed.candidateId,
        documents: evidenceDocuments
      }
    );

    return {
      profileId: String(profileId),
      candidateId: parsed.candidateId,
      evidenceCount: evidenceDocuments.length
    };
  }
});

export const ingestCandidateEvidence = actionGeneric({
  args: {
    candidateId: v.float64(),
    rawEvidenceText: v.optional(v.string()),
    blocks: v.optional(
      v.array(
        v.object({
          type: evidenceTypeValidator,
          text: v.string(),
          tags: v.array(v.string()),
          title: v.optional(v.string()),
          techStack: v.array(v.string()),
          domains: v.array(v.string()),
          impactSummary: v.optional(v.string())
        })
      )
    ),
    embeddingModel: v.optional(v.string()),
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const parsed = candidateEvidenceInputSchema.parse({
      candidateId: args.candidateId,
      rawEvidenceText: args.rawEvidenceText,
      blocks: args.blocks ?? []
    });

    const profileSummaryPromise = (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<{
      displayName: string;
      coreDomains: string[];
      positioningSummary: string;
    } | null>)(anyApi.profiles.getCandidateProfileSummary, {
      candidateId: parsed.candidateId
    });
    const candidateProfile = await profileSummaryPromise;

    if (!candidateProfile) {
      throw new Error(`Candidate profile ${parsed.candidateId} not found.`);
    }

    const runners = createProposalEngineRunners({
      fastModel: args.fastModel,
      reasoningModel: args.reasoningModel
    });

    const extracted = parsed.rawEvidenceText?.trim()
      ? await runners.extractCandidateEvidence.invoke(
          buildCandidateEvidencePrompt({
            candidateSummary: parsed.rawEvidenceText,
            displayName: candidateProfile.displayName,
            knownDomains: candidateProfile.coreDomains
          })
        )
      : { blocks: [] };

    const createdAt = Date.now();
    const evidenceDocuments = await buildCandidateEvidenceDocuments({
      candidateId: parsed.candidateId,
      blocks: [...parsed.blocks, ...extracted.blocks],
      source: "candidate_profile",
      createdAt,
      embeddingModel: args.embeddingModel
    });

    const insertedIds = await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<string[]>)(
      internal.profiles.insertCandidateEvidenceBlocks,
      {
        documents: evidenceDocuments
      }
    );

    return {
      candidateId: parsed.candidateId,
      evidenceCount: insertedIds.length
    };
  }
});

export const deleteCandidateEvidenceBlock = actionGeneric({
  args: {
    evidenceBlockId: v.id("candidate_evidence_blocks")
  },
  handler: async (ctx, args) => {
    const deleted = await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<{
      _id: string;
      candidateId: number;
      source: "candidate_profile" | "case_inference";
      deleted: boolean;
    } | null>)(internal.profiles.deleteCandidateEvidenceBlockRecord, args);

    if (!deleted) {
      throw new Error("Evidence block not found.");
    }

    if (!deleted.deleted || deleted.source !== "candidate_profile") {
      throw new Error("Only candidate-authored evidence blocks can be deleted here.");
    }

    return {
      evidenceBlockId: String(deleted._id),
      candidateId: deleted.candidateId
    };
  }
});

export const deleteCandidate = actionGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const existingProfile = await (ctx.runQuery as (queryRef: unknown, queryArgs: unknown) => Promise<{
      _id: string;
    } | null>)(anyApi.profiles.getCandidateProfile, {
      candidateId: args.candidateId
    });

    if (!existingProfile) {
      throw new Error(`Candidate ${args.candidateId} not found.`);
    }

    const deleted = await (ctx.runMutation as (mutationRef: unknown, mutationArgs: unknown) => Promise<{
      deletedProfiles: number;
      deletedEvidenceBlocks: number;
      deletedFragments: number;
      deletedHistoricalCases: number;
      deletedClusters: number;
      deletedGenerationRuns: number;
    }>)(internal.profiles.deleteCandidateRecordTree, {
      candidateId: args.candidateId
    });

    return {
      candidateId: args.candidateId,
      ...deleted
    };
  }
});
