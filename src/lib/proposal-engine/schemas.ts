import { z } from "zod";

export const evidenceTypeSchema = z.enum([
  "project",
  "responsibility",
  "tech",
  "impact",
  "domain",
  "achievement"
]);

export const fragmentTypeSchema = z.enum(["opening", "proof", "closing"]);

export const jobLengthBucketSchema = z.enum(["short", "medium", "long"]);

export const proposalLengthBucketSchema = z.enum(["short", "medium", "long"]);
export const maxProposalCoverLetterChars = 5000;

export const toneProfileSchema = z.enum(["concise", "consultative", "confident", "technical", "founder-like"]);

export const proposalQuestionSchema = z.object({
  position: z.number().int().positive(),
  prompt: z.string().trim().min(1)
});

export const proposalQuestionAnswerSchema = z.object({
  position: z.number().int().positive(),
  prompt: z.string().trim().min(1),
  answer: z.string().trim().min(1)
});

export const unresolvedProposalQuestionSchema = z.object({
  position: z.number().int().positive(),
  prompt: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

export const proposalStrategySchema = z.object({
  tone: toneProfileSchema,
  length: proposalLengthBucketSchema,
  focus: z.array(z.string().trim().min(1)).min(1)
});

export const jobExtractSchema = z.object({
  projectType: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  requiredSkills: z.array(z.string().trim().min(1)),
  optionalSkills: z.array(z.string().trim().min(1)),
  senioritySignals: z.array(z.string().trim().min(1)),
  deliverables: z.array(z.string().trim().min(1)),
  constraints: z.array(z.string().trim().min(1)),
  stack: z.array(z.string().trim().min(1)),
  softSignals: z.array(z.string().trim().min(1)),
  jobLengthBucket: jobLengthBucketSchema,
  clientNeeds: z.array(z.string().trim().min(1)).min(1),
  summary: z.string().trim().min(1)
});

export const proposalExtractSchema = z.object({
  hook: z.string().trim().min(1),
  valueProposition: z.string().trim().min(1),
  experienceClaims: z.array(z.string().trim().min(1)).min(1),
  techMapping: z.array(z.string().trim().min(1)).min(1),
  proofPoints: z.array(z.string().trim().min(1)).min(1),
  cta: z.string().trim().min(1),
  tone: toneProfileSchema,
  lengthBucket: proposalLengthBucketSchema,
  specificityScore: z.number().min(0).max(1),
  genericnessScore: z.number().min(0).max(1)
});

export const qualityRubricSchema = z.object({
  relevance: z.number().min(1).max(5),
  specificity: z.number().min(1).max(5),
  credibility: z.number().min(1).max(5),
  tone: z.number().min(1).max(5),
  clarity: z.number().min(1).max(5),
  ctaStrength: z.number().min(1).max(5)
});

export const caseQualitySchema = z.object({
  rubric: qualityRubricSchema,
  overall: z.number().min(0).max(1),
  humanScore: z.number().min(0).max(1),
  specificityScore: z.number().min(0).max(1),
  genericnessScore: z.number().min(0).max(1)
});

export const jobUnderstandingSchema = z.object({
  jobSummary: z.string().trim().min(1),
  clientNeeds: z.array(z.string().trim().min(1)).min(1),
  mustHaveSkills: z.array(z.string().trim().min(1)),
  niceToHaveSkills: z.array(z.string().trim().min(1)),
  projectRiskFlags: z.array(z.string().trim().min(1)),
  proposalStrategy: proposalStrategySchema
});

export const candidateEvidenceSelectionSchema = z.object({
  evidenceId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

export const evidenceSelectionOutputSchema = z.object({
  selectedEvidence: z.array(candidateEvidenceSelectionSchema).min(1).max(4)
});

export const proposalPlanSchema = z.object({
  openingAngle: z.string().trim().min(1),
  mainPoints: z.array(z.string().trim().min(1)).min(1),
  selectedEvidenceIds: z.array(z.string().trim().min(1)).min(1),
  selectedFragmentIds: z.array(z.string().trim().min(1)).min(1),
  avoid: z.array(z.string().trim().min(1)),
  ctaStyle: z.string().trim().min(1)
});

export const copyRiskSchema = z.object({
  triggered: z.boolean(),
  maxParagraphCosine: z.number().min(0).max(1),
  trigramOverlap: z.number().min(0).max(1),
  matchedCaseIds: z.array(z.string().trim().min(1)),
  matchedFragmentIds: z.array(z.string().trim().min(1)),
  reasons: z.array(z.string().trim().min(1))
});

export const draftCritiqueSchema = z.object({
  rubric: qualityRubricSchema,
  issues: z.array(z.string().trim().min(1)),
  revisionInstructions: z.array(z.string().trim().min(1)),
  approvalStatus: z.enum(["APPROVED", "NEEDS_REVISION"]),
  copyRisk: copyRiskSchema
});

export const candidateExternalProfilesSchema = z.object({
  githubUrl: z.string().trim().url().optional(),
  websiteUrl: z.string().trim().url().optional(),
  portfolioUrl: z.string().trim().url().optional()
});

export const outcomeSignalsSchema = z.object({
  reply: z.boolean().optional(),
  interview: z.boolean().optional(),
  hired: z.boolean().optional()
});

export const candidateProfileMetadataSchema = z.object({
  seniority: z.string().trim().min(1).optional(),
  availability: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  externalProfiles: candidateExternalProfilesSchema.default({})
});

export const candidateProfileInputSchema = z.object({
  candidateId: z.number().int().positive(),
  displayName: z.string().trim().min(1),
  positioningSummary: z.string().trim().min(1),
  toneProfile: toneProfileSchema,
  coreDomains: z.array(z.string().trim().min(1)).min(1),
  preferredCtaStyle: z.string().trim().min(1),
  metadata: candidateProfileMetadataSchema.default({})
});

export const candidateEvidenceInputBlockSchema = z.object({
  type: evidenceTypeSchema,
  text: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).default([]),
  title: z.string().trim().min(1).optional(),
  techStack: z.array(z.string().trim().min(1)).default([]),
  domains: z.array(z.string().trim().min(1)).default([]),
  impactSummary: z.string().trim().min(1).optional()
});

export const candidateEvidenceInputSchema = z.object({
  candidateId: z.number().int().positive(),
  rawEvidenceText: z.string().trim().optional(),
  blocks: z.array(candidateEvidenceInputBlockSchema).default([])
});

export const candidateEvidenceExtractionBlockSchema = z.object({
  type: evidenceTypeSchema,
  text: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)),
  title: z.string().trim().min(1).nullable(),
  techStack: z.array(z.string().trim().min(1)),
  domains: z.array(z.string().trim().min(1)),
  impactSummary: z.string().trim().min(1).nullable()
});

export const candidateEvidenceExtractionSchema = z.object({
  blocks: z.array(candidateEvidenceExtractionBlockSchema).min(1)
});

export const historicalCaseInputSchema = z.object({
  candidateId: z.number().int().positive(),
  jobTitle: z.string().trim().min(1),
  jobDescription: z.string().trim().min(1),
  proposalText: z.string().trim().min(1),
  outcome: outcomeSignalsSchema.default({})
});

export const generationJobInputSchema = z.object({
  title: z.string().trim().optional(),
  description: z.string().trim().min(30),
  proposalQuestions: z.array(proposalQuestionSchema).default([])
});

export const questionAnsweringOutputSchema = z.object({
  answers: z.array(proposalQuestionAnswerSchema),
  unresolved: z.array(unresolvedProposalQuestionSchema)
});

export const fragmentRecordSchema = z.object({
  fragmentType: fragmentTypeSchema,
  text: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)),
  specificityScore: z.number().min(0).max(1),
  genericnessScore: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1)
});

export type EvidenceType = z.infer<typeof evidenceTypeSchema>;
export type FragmentType = z.infer<typeof fragmentTypeSchema>;
export type ProposalLengthBucket = z.infer<typeof proposalLengthBucketSchema>;
export type ToneProfile = z.infer<typeof toneProfileSchema>;
export type ProposalQuestion = z.infer<typeof proposalQuestionSchema>;
export type ProposalQuestionAnswer = z.infer<typeof proposalQuestionAnswerSchema>;
export type UnresolvedProposalQuestion = z.infer<typeof unresolvedProposalQuestionSchema>;
export type JobExtract = z.infer<typeof jobExtractSchema>;
export type ProposalExtract = z.infer<typeof proposalExtractSchema>;
export type QualityRubric = z.infer<typeof qualityRubricSchema>;
export type CaseQuality = z.infer<typeof caseQualitySchema>;
export type JobUnderstanding = z.infer<typeof jobUnderstandingSchema>;
export type EvidenceSelectionOutput = z.infer<typeof evidenceSelectionOutputSchema>;
export type ProposalPlan = z.infer<typeof proposalPlanSchema>;
export type CopyRisk = z.infer<typeof copyRiskSchema>;
export type DraftCritique = z.infer<typeof draftCritiqueSchema>;
export type CandidateExternalProfiles = z.infer<typeof candidateExternalProfilesSchema>;
export type OutcomeSignals = z.infer<typeof outcomeSignalsSchema>;
export type CandidateProfileInput = z.infer<typeof candidateProfileInputSchema>;
export type CandidateEvidenceInput = z.infer<typeof candidateEvidenceInputSchema>;
export type CandidateEvidenceInputBlock = z.infer<typeof candidateEvidenceInputBlockSchema>;
export type CandidateEvidenceExtractionBlock = z.infer<typeof candidateEvidenceExtractionBlockSchema>;
export type CandidateEvidenceExtraction = z.infer<typeof candidateEvidenceExtractionSchema>;
export type HistoricalCaseInput = z.infer<typeof historicalCaseInputSchema>;
export type GenerationJobInput = z.infer<typeof generationJobInputSchema>;
export type QuestionAnsweringOutput = z.infer<typeof questionAnsweringOutputSchema>;
export type FragmentRecord = z.infer<typeof fragmentRecordSchema>;
