import { queryGeneric } from "convex/server";
import { v } from "convex/values";

import { sortClusterCases } from "../src/lib/proposal-engine/library-admin";

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

export const getHistoricalCaseDetail = queryGeneric({
  args: {
    id: v.id("historical_cases")
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) {
      return null;
    }

    const [cluster, fragments, evidenceBlocks, clusterCases] = await Promise.all([
      record.clusterId ? ctx.db.get(record.clusterId) : null,
      ctx.db
        .query("proposal_fragments")
        .withIndex("by_case_id", (query) => query.eq("caseId", args.id))
        .collect(),
      ctx.db
        .query("candidate_evidence_blocks")
        .withIndex("by_source_case_id", (query) => query.eq("sourceCaseId", args.id))
        .collect(),
      record.clusterId
        ? ctx.db
            .query("historical_cases")
            .withIndex("by_cluster_id", (query) => query.eq("clusterId", record.clusterId))
            .collect()
        : Promise.resolve([])
    ]);

    const sortedClusterCases = sortClusterCases(
      clusterCases.map((item) => ({
        _id: String(item._id),
        candidateId: item.candidateId,
        clusterId: item.clusterId ? String(item.clusterId) : null,
        canonical: item.canonical,
        jobTitle: item.jobTitle,
        normalizedProposalText: item.normalizedProposalText,
        proposalExtract: {
          hook: item.proposalExtract.hook
        },
        quality: {
          overall: item.quality.overall,
          humanScore: item.quality.humanScore,
          specificityScore: item.quality.specificityScore,
          genericnessScore: item.quality.genericnessScore
        },
        outcome: item.outcome,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      })),
      cluster?.representativeCaseId ? String(cluster.representativeCaseId) : String(record._id)
    );

    return {
      _id: String(record._id),
      candidateId: record.candidateId,
      clusterId: record.clusterId ? String(record.clusterId) : null,
      canonical: record.canonical,
      jobTitle: record.jobTitle,
      rawJobDescription: record.rawJobDescription,
      rawProposalText: record.rawProposalText,
      normalizedJobDescription: record.normalizedJobDescription,
      normalizedProposalText: record.normalizedProposalText,
      domain: record.domain,
      projectType: record.projectType,
      jobExtract: record.jobExtract,
      proposalExtract: record.proposalExtract,
      quality: record.quality,
      outcome: record.outcome,
      cluster: cluster
        ? {
            _id: String(cluster._id),
            clusterSize: cluster.clusterSize,
            qualityScore: cluster.qualityScore,
            duplicateMethod: cluster.duplicateMethod,
            representativeCaseId: cluster.representativeCaseId ? String(cluster.representativeCaseId) : null
          }
        : null,
      clusterCases: sortedClusterCases.map((item) => ({
        _id: item._id,
        canonical: item.canonical,
        jobTitle: item.jobTitle,
        hook: item.proposalExtract.hook,
        overallQuality: item.quality.overall,
        outcome: item.outcome,
        updatedAt: item.updatedAt
      })),
      fragments: fragments
        .sort((left, right) => left.fragmentType.localeCompare(right.fragmentType) || left.createdAt - right.createdAt)
        .map((fragment) => ({
          _id: String(fragment._id),
          fragmentType: fragment.fragmentType,
          text: fragment.text,
          tags: fragment.tags,
          qualityScore: fragment.qualityScore,
          retrievalEligible: fragment.retrievalEligible
        })),
      evidenceBlocks: evidenceBlocks
        .sort((left, right) => right.confidence - left.confidence)
        .map((block) => ({
          _id: String(block._id),
          type: block.type,
          text: block.text,
          tags: block.tags,
          confidence: block.confidence,
          active: block.active,
          techStack: block.structured.techStack,
          domains: block.structured.domains
        })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
});
