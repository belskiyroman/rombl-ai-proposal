import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const legacySourceValidator = v.union(v.literal("manual"), v.literal("chrome_extension"));
const caseSourceValidator = v.union(v.literal("manual"), v.literal("backfill"));
const evidenceSourceValidator = v.union(v.literal("candidate_profile"), v.literal("case_inference"));
const projectTypeValidator = v.union(v.literal("hourly"), v.literal("fixedPrice"), v.literal("hourly/fixedPrice"));
const proposalToneValidator = v.union(
  v.literal("concise"),
  v.literal("consultative"),
  v.literal("confident"),
  v.literal("technical"),
  v.literal("founder-like")
);
const bucketValidator = v.union(v.literal("short"), v.literal("medium"), v.literal("long"));
const evidenceTypeValidator = v.union(
  v.literal("project"),
  v.literal("responsibility"),
  v.literal("tech"),
  v.literal("impact"),
  v.literal("domain"),
  v.literal("achievement")
);
const fragmentTypeValidator = v.union(v.literal("opening"), v.literal("proof"), v.literal("closing"));
const writingStyleAnalysisValidator = v.object({
  formality: v.float64(),
  enthusiasm: v.float64(),
  keyVocabulary: v.array(v.string()),
  sentenceStructure: v.string()
});
const proposalStrategyValidator = v.object({
  tone: proposalToneValidator,
  length: bucketValidator,
  focus: v.array(v.string())
});
const jobExtractValidator = v.object({
  projectType: v.string(),
  domain: v.string(),
  requiredSkills: v.array(v.string()),
  optionalSkills: v.array(v.string()),
  senioritySignals: v.array(v.string()),
  deliverables: v.array(v.string()),
  constraints: v.array(v.string()),
  stack: v.array(v.string()),
  softSignals: v.array(v.string()),
  jobLengthBucket: bucketValidator,
  clientNeeds: v.array(v.string()),
  summary: v.string()
});
const proposalExtractValidator = v.object({
  hook: v.string(),
  valueProposition: v.string(),
  experienceClaims: v.array(v.string()),
  techMapping: v.array(v.string()),
  proofPoints: v.array(v.string()),
  cta: v.string(),
  tone: proposalToneValidator,
  lengthBucket: bucketValidator,
  specificityScore: v.float64(),
  genericnessScore: v.float64()
});
const qualityRubricValidator = v.object({
  relevance: v.float64(),
  specificity: v.float64(),
  credibility: v.float64(),
  tone: v.float64(),
  clarity: v.float64(),
  ctaStrength: v.float64()
});
const caseQualityValidator = v.object({
  rubric: qualityRubricValidator,
  overall: v.float64(),
  humanScore: v.float64(),
  specificityScore: v.float64(),
  genericnessScore: v.float64()
});
const outcomeSignalsValidator = v.object({
  reply: v.optional(v.boolean()),
  interview: v.optional(v.boolean()),
  hired: v.optional(v.boolean())
});
const candidateProfileMetadataValidator = v.object({
  seniority: v.optional(v.string()),
  availability: v.optional(v.string()),
  location: v.optional(v.string()),
  notes: v.optional(v.string())
});
const candidateEvidenceStructuredValidator = v.object({
  title: v.optional(v.string()),
  techStack: v.array(v.string()),
  domains: v.array(v.string()),
  impactSummary: v.optional(v.string())
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
  rubric: qualityRubricValidator,
  issues: v.array(v.string()),
  revisionInstructions: v.array(v.string()),
  approvalStatus: v.union(v.literal("APPROVED"), v.literal("NEEDS_REVISION")),
  copyRisk: copyRiskValidator
});
const generationJobInputValidator = v.object({
  title: v.optional(v.string()),
  description: v.string()
});
const jobUnderstandingValidator = v.object({
  jobSummary: v.string(),
  clientNeeds: v.array(v.string()),
  mustHaveSkills: v.array(v.string()),
  niceToHaveSkills: v.array(v.string()),
  projectRiskFlags: v.array(v.string()),
  proposalStrategy: proposalStrategyValidator
});

export default defineSchema({
  candidate_profiles: defineTable({
    candidateId: v.float64(),
    displayName: v.string(),
    positioningSummary: v.string(),
    toneProfile: proposalToneValidator,
    coreDomains: v.array(v.string()),
    preferredCtaStyle: v.string(),
    metadata: candidateProfileMetadataValidator,
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_updated_at", ["updatedAt"]),

  candidate_evidence_blocks: defineTable({
    candidateId: v.float64(),
    source: evidenceSourceValidator,
    sourceCaseId: v.optional(v.id("historical_cases")),
    type: evidenceTypeValidator,
    text: v.string(),
    tags: v.array(v.string()),
    structured: candidateEvidenceStructuredValidator,
    confidence: v.float64(),
    active: v.boolean(),
    embedding: v.array(v.float64()),
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_source_case_id", ["sourceCaseId"])
    .index("by_candidate_id_and_type", ["candidateId", "type"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["candidateId", "type", "active", "source"]
    }),

  proposal_clusters: defineTable({
    candidateId: v.float64(),
    representativeCaseId: v.optional(v.id("historical_cases")),
    clusterSize: v.float64(),
    centroidFingerprint: v.string(),
    qualityScore: v.float64(),
    duplicateMethod: v.string(),
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_representative_case_id", ["representativeCaseId"])
    .index("by_updated_at", ["updatedAt"]),

  historical_cases: defineTable({
    candidateId: v.float64(),
    source: caseSourceValidator,
    jobTitle: v.string(),
    rawJobDescription: v.string(),
    rawProposalText: v.string(),
    normalizedJobDescription: v.string(),
    normalizedProposalText: v.string(),
    jobExtract: jobExtractValidator,
    proposalExtract: proposalExtractValidator,
    quality: caseQualityValidator,
    outcome: outcomeSignalsValidator,
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
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_cluster_id", ["clusterId"])
    .index("by_candidate_id_and_canonical", ["candidateId", "canonical"])
    .index("by_created_at", ["createdAt"])
    .vectorIndex("by_raw_job_embedding", {
      vectorField: "rawJobEmbedding",
      dimensions: 1536,
      filterFields: ["candidateId", "canonical", "domain", "projectType"]
    })
    .vectorIndex("by_job_summary_embedding", {
      vectorField: "jobSummaryEmbedding",
      dimensions: 1536,
      filterFields: ["candidateId", "canonical", "domain", "projectType"]
    })
    .vectorIndex("by_needs_embedding", {
      vectorField: "needsEmbedding",
      dimensions: 1536,
      filterFields: ["candidateId", "canonical", "domain", "projectType"]
    }),

  proposal_fragments: defineTable({
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
  })
    .index("by_case_id", ["caseId"])
    .index("by_candidate_id_and_type", ["candidateId", "fragmentType"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["candidateId", "fragmentType", "retrievalEligible"]
    }),

  generation_runs_v2: defineTable({
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
    .index("by_candidate_id", ["candidateId"])
    .index("by_created_at", ["createdAt"]),

  raw_jobs: defineTable({
    source: legacySourceValidator,
    externalJobId: v.optional(v.float64()),
    jobLink: v.optional(v.string()),
    clientLocation: v.string(),
    clientReview: v.float64(),
    clientReviewAmount: v.float64(),
    clientTotalSpent: v.float64(),
    projectType: projectTypeValidator,
    skills: v.array(v.string()),
    title: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    techStack: v.array(v.string()),
    projectConstraints: v.array(v.string()),
    memberId: v.float64(),
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_member_id", ["memberId"])
    .index("by_created_at", ["createdAt"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["source", "clientLocation"]
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["source", "clientLocation"]
    }),

  style_profiles: defineTable({
    source: legacySourceValidator,
    memberId: v.float64(),
    memberName: v.string(),
    memberLocation: v.string(),
    agency: v.boolean(),
    agencyName: v.optional(v.string()),
    talentBadge: v.optional(v.string()),
    jss: v.float64(),
    writingStyleAnalysis: writingStyleAnalysisValidator,
    keyVocabulary: v.array(v.string()),
    sentenceStructure: v.string(),
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_member_id", ["memberId"])
    .index("by_created_at", ["createdAt"]),

  processed_proposals: defineTable({
    source: legacySourceValidator,
    externalProposalId: v.float64(),
    externalJobId: v.optional(v.float64()),
    memberId: v.float64(),
    viewed: v.boolean(),
    interview: v.boolean(),
    offer: v.boolean(),
    price: v.string(),
    priceAmount: v.float64(),
    agency: v.boolean(),
    text: v.string(),
    rawJobId: v.id("raw_jobs"),
    styleProfileId: v.id("style_profiles"),
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_external_proposal_id", ["externalProposalId"])
    .index("by_member_id", ["memberId"])
    .index("by_raw_job_id", ["rawJobId"])
    .index("by_created_at", ["createdAt"]),

  jobProposalPairs: defineTable({
    source: legacySourceValidator,
    jobText: v.string(),
    proposalText: v.string(),
    embedding: v.array(v.float64()),
    techStack: v.array(v.string()),
    projectConstraints: v.array(v.string()),
    writingStyleAnalysis: writingStyleAnalysisValidator,
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_created_at", ["createdAt"])
    .searchIndex("search_job_text", {
      searchField: "jobText",
      filterFields: ["source"]
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["source"]
    }),

  generationRuns: defineTable({
    jobText: v.string(),
    embedding: v.array(v.float64()),
    ragContextIds: v.array(v.id("jobProposalPairs")),
    proposalDraft: v.string(),
    finalProposal: v.string(),
    criticStatus: v.union(v.literal("APPROVED"), v.literal("NEEDS_REVISION")),
    critiquePoints: v.optional(v.array(v.string())),
    iterations: v.float64(),
    createdAt: v.float64()
  }).index("by_created_at", ["createdAt"])
});
