import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const evidenceSourceValidator = v.union(v.literal("candidate_profile"), v.literal("case_inference"));
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
  quality: caseQualityValidator,
  outcome: v.optional(outcomeSignalsValidator),
  finalScore: v.optional(v.float64()),
  semanticScore: v.optional(v.float64())
});
const retrievedFragmentSnapshotValidator = v.object({
  _id: v.string(),
  clusterId: v.optional(v.union(v.string(), v.null())),
  candidateId: v.float64(),
  fragmentType: fragmentTypeValidator,
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
  type: evidenceTypeValidator,
  text: v.string(),
  tags: v.array(v.string()),
  techStack: v.array(v.string()),
  domains: v.array(v.string()),
  confidence: v.float64(),
  active: v.boolean(),
  source: evidenceSourceValidator
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
    source: v.optional(v.string()),
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
    .index("by_candidate_id", ["candidateId"])
    .index("by_case_id", ["caseId"])
    .index("by_candidate_id_and_type", ["candidateId", "fragmentType"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["candidateId", "fragmentType", "retrievalEligible"]
    }),

  generation_runs: defineTable({
    candidateId: v.float64(),
    jobInput: generationJobInputValidator,
    jobUnderstanding: jobUnderstandingValidator,
    retrievedCaseIds: v.array(v.id("historical_cases")),
    retrievedFragmentIds: v.array(v.id("proposal_fragments")),
    retrievedEvidenceIds: v.array(v.id("candidate_evidence_blocks")),
    executionTrace: v.optional(v.array(v.string())),
    retrievedContextSnapshot: v.optional(retrievedContextSnapshotValidator),
    candidateSnapshot: v.optional(candidateSnapshotValidator),
    selectedEvidence: v.array(selectedEvidenceValidator),
    proposalPlan: proposalPlanValidator,
    draftHistory: v.array(v.string()),
    critiqueHistory: v.array(draftCritiqueValidator),
    copyRisk: copyRiskValidator,
    stepTelemetry: v.optional(v.array(stepTelemetryValidator)),
    telemetrySummary: v.optional(telemetrySummaryValidator),
    finalProposal: v.string(),
    approvalStatus: v.union(v.literal("APPROVED"), v.literal("NEEDS_REVISION")),
    createdAt: v.float64(),
    updatedAt: v.float64()
  })
    .index("by_candidate_id", ["candidateId"])
    .index("by_candidate_id_and_created_at", ["candidateId", "createdAt"])
    .index("by_created_at", ["createdAt"])
});
