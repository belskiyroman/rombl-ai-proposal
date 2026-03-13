import { z } from "zod";

import { generationJobInputSchema } from "./proposal-engine/schemas";

export const extensionSourceSiteSchema = z.literal("upwork");

export const extensionCandidateSummarySchema = z.object({
  _id: z.string(),
  candidateId: z.number().int().positive(),
  displayName: z.string(),
  toneProfile: z.string(),
  coreDomains: z.array(z.string()),
  preferredCtaStyle: z.string(),
  updatedAt: z.number()
});

export const extensionCandidatesResponseSchema = z.object({
  candidates: z.array(extensionCandidateSummarySchema)
});

export const extensionGenerateRequestSchema = z.object({
  candidateId: z.number().int().positive(),
  title: generationJobInputSchema.shape.title,
  description: generationJobInputSchema.shape.description,
  sourceSite: extensionSourceSiteSchema,
  sourceUrl: z.string().url()
});

export const extensionGenerateResponseSchema = z.object({
  progressId: z.string()
});

export const extensionGenerateStatusQuerySchema = z.object({
  id: z.string().min(1)
});

export const extensionGenerationProgressSchema = z.object({
  _id: z.string(),
  candidateId: z.number().int().positive(),
  jobInput: generationJobInputSchema,
  status: z.union([z.literal("QUEUED"), z.literal("RUNNING"), z.literal("COMPLETED"), z.literal("FAILED")]),
  currentStep: z
    .object({
      step: z.string(),
      label: z.string(),
      attempt: z.number(),
      startedAt: z.number()
    })
    .nullable(),
  steps: z.array(
    z.object({
      step: z.string(),
      label: z.string(),
      status: z.union([z.literal("RUNNING"), z.literal("COMPLETED"), z.literal("FAILED")]),
      attempt: z.number(),
      startedAt: z.number(),
      finishedAt: z.number().optional(),
      durationMs: z.number().optional()
    })
  ),
  startedAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  totalDurationMs: z.number().optional(),
  errorMessage: z.string().optional(),
  generationRunId: z.string().nullable().optional()
});

export const extensionGenerationResultSchema = z.object({
  generationRunId: z.string(),
  finalProposal: z.string(),
  approvalStatus: z.union([z.literal("APPROVED"), z.literal("NEEDS_REVISION")]),
  createdAt: z.number()
});

export const extensionGenerateStatusResponseSchema = z.object({
  progress: extensionGenerationProgressSchema.nullable(),
  result: extensionGenerationResultSchema.nullable()
});

export type ExtensionCandidateSummary = z.infer<typeof extensionCandidateSummarySchema>;
export type ExtensionCandidatesResponse = z.infer<typeof extensionCandidatesResponseSchema>;
export type ExtensionGenerateRequest = z.infer<typeof extensionGenerateRequestSchema>;
export type ExtensionGenerateResponse = z.infer<typeof extensionGenerateResponseSchema>;
export type ExtensionGenerateStatusResponse = z.infer<typeof extensionGenerateStatusResponseSchema>;
export type ExtensionGenerationResult = z.infer<typeof extensionGenerationResultSchema>;
