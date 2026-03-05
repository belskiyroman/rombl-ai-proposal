import { z } from "zod";

export const ingestionSourceSchema = z.enum(["manual", "chrome_extension"]);

export const jobSchema = z.object({
  jobLink: z.string().trim().optional(),
  clientLocation: z.string().trim().regex(/^[A-Z]{2,3}$/),
  clientReview: z.number().min(0).max(5),
  clientReviewAmount: z.number().int().nonnegative(),
  clientTotalSpent: z.number().nonnegative(),
  type: z.enum(["hourly", "fixedPrice", "hourly/fixedPrice"]),
  skills: z.array(z.string().trim().min(1)).min(1),
  title: z.string().trim().min(1),
  text: z.string().trim().min(1)
});

const proposalPriceSchema = z.string().trim().regex(/^\d+(\.\d+)?$/);

export const proposalSchema = z.object({
  id: z.number().int().positive(),
  viewed: z.boolean(),
  interview: z.boolean(),
  offer: z.boolean(),
  price: proposalPriceSchema,
  agency: z.boolean(),
  memberId: z.number().int().positive(),
  text: z.string().trim().min(1)
});

export const memberSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  agency: z.boolean(),
  agencyName: z.string().trim().min(1).optional(),
  talentBadge: z.string().trim().min(1).optional(),
  jss: z.number().min(0).max(100),
  location: z.string().trim().regex(/^[A-Z]{2,3}$/)
});

export const writingStyleAnalysisSchema = z.object({
  formality: z.number().min(1).max(10),
  enthusiasm: z.number().min(1).max(10),
  key_vocabulary: z.array(z.string().trim().min(1)),
  sentence_structure: z.string().trim().min(1)
});

export const analyzerOutputSchema = z.object({
  tech_stack: z.array(z.string().trim().min(1)),
  writing_style_analysis: writingStyleAnalysisSchema,
  project_constraints: z.array(z.string().trim().min(1))
});

export const ingestionInputSchema = z.object({
  source: ingestionSourceSchema.default("manual"),
  job: jobSchema,
  proposal: proposalSchema,
  member: memberSchema
});

export const rawJobDocumentSchema = z.object({
  source: ingestionSourceSchema,
  jobLink: z.string().trim().optional(),
  clientLocation: z.string().trim().regex(/^[A-Z]{2,3}$/),
  clientReview: z.number().min(0).max(5),
  clientReviewAmount: z.number().int().nonnegative(),
  clientTotalSpent: z.number().nonnegative(),
  projectType: jobSchema.shape.type,
  skills: z.array(z.string().trim().min(1)).min(1),
  title: z.string().trim().min(1),
  text: z.string().trim().min(1),
  embedding: z.array(z.number()).min(1),
  techStack: z.array(z.string().trim().min(1)),
  projectConstraints: z.array(z.string().trim().min(1)),
  memberId: z.number().int().positive(),
  createdAt: z.number(),
  updatedAt: z.number()
});

export const styleProfileDocumentSchema = z.object({
  source: ingestionSourceSchema,
  memberId: z.number().int().positive(),
  memberName: z.string().trim().min(1),
  memberLocation: z.string().trim().regex(/^[A-Z]{2,3}$/),
  agency: z.boolean(),
  agencyName: z.string().trim().min(1).optional(),
  talentBadge: z.string().trim().min(1).optional(),
  jss: z.number().min(0).max(100),
  writingStyleAnalysis: z.object({
    formality: z.number().min(1).max(10),
    enthusiasm: z.number().min(1).max(10),
    keyVocabulary: z.array(z.string().trim().min(1)),
    sentenceStructure: z.string().trim().min(1)
  }),
  keyVocabulary: z.array(z.string().trim().min(1)),
  sentenceStructure: z.string().trim().min(1),
  createdAt: z.number(),
  updatedAt: z.number()
});

export const processedProposalDocumentSchema = z.object({
  source: ingestionSourceSchema,
  externalProposalId: z.number().int().positive(),
  memberId: z.number().int().positive(),
  viewed: z.boolean(),
  interview: z.boolean(),
  offer: z.boolean(),
  price: proposalPriceSchema,
  priceAmount: z.number().nonnegative(),
  agency: z.boolean(),
  text: z.string().trim().min(1),
  rawJobId: z.string().trim().min(1),
  styleProfileId: z.string().trim().min(1),
  createdAt: z.number(),
  updatedAt: z.number()
});

export function parseProposalPrice(price: string): number {
  return Number(proposalPriceSchema.parse(price));
}

export type Job = z.infer<typeof jobSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type Member = z.infer<typeof memberSchema>;
export type AnalyzerOutput = z.infer<typeof analyzerOutputSchema>;
export type IngestionInput = z.infer<typeof ingestionInputSchema>;
export type RawJobDocument = z.infer<typeof rawJobDocumentSchema>;
export type ProcessedProposalDocument = z.infer<typeof processedProposalDocumentSchema>;
export type StyleProfileDocument = z.infer<typeof styleProfileDocumentSchema>;
