import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const sourceValidator = v.union(v.literal("manual"), v.literal("chrome_extension"));
const projectTypeValidator = v.union(v.literal("hourly"), v.literal("fixedPrice"), v.literal("hourly/fixedPrice"));
const writingStyleAnalysisValidator = v.object({
  formality: v.float64(),
  enthusiasm: v.float64(),
  keyVocabulary: v.array(v.string()),
  sentenceStructure: v.string()
});

export default defineSchema({
  raw_jobs: defineTable({
    source: sourceValidator,
    externalJobId: v.float64(),
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
    .index("by_external_job_id", ["externalJobId"])
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
    source: sourceValidator,
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
    source: sourceValidator,
    externalProposalId: v.float64(),
    externalJobId: v.float64(),
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
    source: sourceValidator,
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
