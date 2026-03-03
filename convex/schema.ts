import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  jobProposalPairs: defineTable({
    source: v.union(v.literal("manual"), v.literal("chrome_extension")),
    jobText: v.string(),
    proposalText: v.string(),
    embedding: v.array(v.float64()),
    techStack: v.array(v.string()),
    projectConstraints: v.array(v.string()),
    writingStyleAnalysis: v.object({
      formality: v.float64(),
      enthusiasm: v.float64(),
      keyVocabulary: v.array(v.string()),
      sentenceStructure: v.string()
    }),
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
