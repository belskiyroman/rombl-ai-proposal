import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listCanonicalCases = queryGeneric({
  args: {
    candidateId: v.float64(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    const cases = await ctx.db
      .query("historical_cases")
      .withIndex("by_candidate_id_and_canonical", (query) => query.eq("candidateId", args.candidateId))
      .order("desc")
      .take(limit * 2);

    const canonicalCases = cases.filter((record) => record.canonical).slice(0, limit);
    const clusterDocs = await Promise.all(
      canonicalCases.map((record) => (record.clusterId ? ctx.db.get(record.clusterId) : null))
    );

    return canonicalCases.map((record, index) => ({
      _id: String(record._id),
      clusterId: record.clusterId ? String(record.clusterId) : null,
      candidateId: record.candidateId,
      jobTitle: record.jobTitle,
      domain: record.domain,
      projectType: record.projectType,
      summary: record.jobExtract.summary,
      hook: record.proposalExtract.hook,
      tone: record.proposalExtract.tone,
      quality: record.quality,
      outcome: record.outcome,
      clusterSize: clusterDocs[index]?.clusterSize ?? 1,
      createdAt: record.createdAt
    }));
  }
});

export const listClusters = queryGeneric({
  args: {
    candidateId: v.float64()
  },
  handler: async (ctx, args) => {
    const clusters = await ctx.db
      .query("proposal_clusters")
      .withIndex("by_candidate_id", (query) => query.eq("candidateId", args.candidateId))
      .collect();

    const representativeCases = await Promise.all(
      clusters.map((cluster) => (cluster.representativeCaseId ? ctx.db.get(cluster.representativeCaseId) : null))
    );

    return clusters
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((cluster, index) => ({
        _id: String(cluster._id),
        candidateId: cluster.candidateId,
        clusterSize: cluster.clusterSize,
        qualityScore: cluster.qualityScore,
        duplicateMethod: cluster.duplicateMethod,
        representativeCaseId: cluster.representativeCaseId ? String(cluster.representativeCaseId) : null,
        representativeTitle: representativeCases[index]?.jobTitle ?? "No representative case",
        representativeHook: representativeCases[index]?.proposalExtract.hook ?? "",
        updatedAt: cluster.updatedAt
      }));
  }
});

export const getHistoricalCasesByIds = queryGeneric({
  args: {
    ids: v.array(v.id("historical_cases"))
  },
  handler: async (ctx, args) => {
    if (args.ids.length === 0) {
      return [];
    }

    const records = await Promise.all(args.ids.map((id) => ctx.db.get(id)));

    return records
      .filter((record): record is NonNullable<typeof record> => record !== null)
      .map((record) => ({
        _id: String(record._id),
        clusterId: record.clusterId ? String(record.clusterId) : null,
        candidateId: record.candidateId,
        canonical: record.canonical,
        jobTitle: record.jobTitle,
        jobExtract: record.jobExtract,
        proposalExtract: {
          hook: record.proposalExtract.hook,
          valueProposition: record.proposalExtract.valueProposition,
          proofPoints: record.proposalExtract.proofPoints,
          tone: record.proposalExtract.tone
        },
        quality: record.quality,
        outcome: record.outcome
      }));
  }
});

export const getProposalFragmentsByIds = queryGeneric({
  args: {
    ids: v.array(v.id("proposal_fragments"))
  },
  handler: async (ctx, args) => {
    if (args.ids.length === 0) {
      return [];
    }

    const fragments = await Promise.all(args.ids.map((id) => ctx.db.get(id)));

    return fragments
      .filter((fragment): fragment is NonNullable<typeof fragment> => fragment !== null)
      .map((fragment) => ({
        _id: String(fragment._id),
        clusterId: fragment.clusterId ? String(fragment.clusterId) : null,
        candidateId: fragment.candidateId,
        fragmentType: fragment.fragmentType,
        text: fragment.text,
        tags: fragment.tags,
        specificityScore: fragment.specificityScore,
        genericnessScore: fragment.genericnessScore,
        qualityScore: fragment.qualityScore,
        retrievalEligible: fragment.retrievalEligible
      }));
  }
});

export const getCandidateEvidenceByIds = queryGeneric({
  args: {
    ids: v.array(v.id("candidate_evidence_blocks"))
  },
  handler: async (ctx, args) => {
    if (args.ids.length === 0) {
      return [];
    }

    const records = await Promise.all(args.ids.map((id) => ctx.db.get(id)));

    return records
      .filter((record): record is NonNullable<typeof record> => record !== null)
      .map((record) => ({
        _id: String(record._id),
        candidateId: record.candidateId,
        type: record.type,
        text: record.text,
        tags: record.tags,
        techStack: record.structured.techStack,
        domains: record.structured.domains,
        confidence: record.confidence,
        active: record.active,
        source: record.source
      }));
  }
});
