import { z } from "zod";

import { proposalQuestionSchema } from "./proposal-engine/schemas";

export const generationHandoffTtlMs = 24 * 60 * 60 * 1000;

export const generationHandoffSourceSiteSchema = z.literal("upwork");

export const generationHandoffCreateRequestSchema = z.object({
  sourceSite: generationHandoffSourceSiteSchema,
  sourceUrl: z.string().url(),
  pageTitle: z.string().trim().min(1).max(300),
  jobTitle: z.string().trim().min(1).max(300),
  jobDescription: z.string().trim().min(40).max(50_000),
  proposalQuestions: z.array(proposalQuestionSchema).default([]),
  capturedAt: z.number().int().nonnegative()
});

export const generationHandoffCreateResponseSchema = z.object({
  handoffId: z.string(),
  generateUrl: z.string().url()
});

export type GenerationHandoffCreateRequest = z.infer<typeof generationHandoffCreateRequestSchema>;
export type GenerationHandoffCreateResponse = z.infer<typeof generationHandoffCreateResponseSchema>;
export type GenerationHandoffSourceSite = z.infer<typeof generationHandoffSourceSiteSchema>;

export interface StoredGenerationHandoff {
  _id: string;
  sourceSite: GenerationHandoffSourceSite;
  sourceUrl: string;
  pageTitle: string;
  jobTitle: string;
  jobDescription: string;
  proposalQuestions: Array<{
    position: number;
    prompt: string;
  }>;
  capturedAt: number;
  createdAt: number;
  expiresAt: number;
}

export type GenerationHandoffLookupResult =
  | { status: "available"; handoff: StoredGenerationHandoff }
  | { status: "invalid" | "missing" | "expired" };

export function normalizeAppBaseUrl(value: string): string {
  const url = new URL(value.trim());
  return url.origin;
}

export function buildGenerateUrl(baseUrl: string, handoffId: string): string {
  const url = new URL("/generate", normalizeAppBaseUrl(baseUrl));
  url.searchParams.set("handoff", handoffId);
  return url.toString();
}

export function toChromeOriginPermissionPattern(baseUrl: string): string {
  return `${normalizeAppBaseUrl(baseUrl)}/*`;
}
