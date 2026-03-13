import {
  generationHandoffCreateRequestSchema,
  generationHandoffCreateResponseSchema,
  normalizeAppBaseUrl,
  toChromeOriginPermissionPattern
} from "../../../src/lib/generation-handoff";
import {
  extensionCandidatesResponseSchema,
  extensionGenerateRequestSchema,
  extensionGenerateResponseSchema,
  extensionGenerateStatusQuerySchema,
  extensionGenerateStatusResponseSchema
} from "../../../src/lib/extension-api";

import type { ExtensionCapturedJob } from "./types";

export { normalizeAppBaseUrl, toChromeOriginPermissionPattern };

export function buildExtensionHandoffApiUrl(baseUrl: string): string {
  return new URL("/api/extension/handoffs", normalizeAppBaseUrl(baseUrl)).toString();
}

export function buildExtensionCandidatesApiUrl(baseUrl: string): string {
  return new URL("/api/extension/candidates", normalizeAppBaseUrl(baseUrl)).toString();
}

export function buildExtensionGenerateApiUrl(baseUrl: string): string {
  return new URL("/api/extension/generate", normalizeAppBaseUrl(baseUrl)).toString();
}

export function buildExtensionGenerateStatusApiUrl(baseUrl: string, progressId: string): string {
  const parsed = extensionGenerateStatusQuerySchema.parse({
    id: progressId
  });
  const url = new URL("/api/extension/generate/status", normalizeAppBaseUrl(baseUrl));
  url.searchParams.set("id", parsed.id);
  return url.toString();
}

export function buildGenerationRunUrl(baseUrl: string, generationRunId: string): string {
  return new URL(`/generate/history/${generationRunId}`, normalizeAppBaseUrl(baseUrl)).toString();
}

export function buildJobPreviewMeta(job: ExtensionCapturedJob): string {
  const parts = [job.sourceSite.toUpperCase(), job.parserMeta.projectType];
  if (job.parserMeta.skillsCount > 0) {
    parts.push(`${job.parserMeta.skillsCount} skills`);
  }

  return parts.join(" • ");
}

export function buildJobPreviewDescription(job: ExtensionCapturedJob): string {
  const normalized = job.jobDescription.replace(/\s+/g, " ").trim();
  if (normalized.length <= 280) {
    return normalized;
  }

  return `${normalized.slice(0, 277).trimEnd()}...`;
}

export function validateOutgoingHandoff(job: ExtensionCapturedJob) {
  return generationHandoffCreateRequestSchema.parse({
    sourceSite: job.sourceSite,
    sourceUrl: job.sourceUrl,
    pageTitle: job.pageTitle,
    jobTitle: job.jobTitle,
    jobDescription: job.jobDescription,
    capturedAt: job.capturedAt
  });
}

export function parseHandoffResponse(payload: unknown) {
  return generationHandoffCreateResponseSchema.parse(payload);
}

export function parseExtensionCandidatesResponse(payload: unknown) {
  return extensionCandidatesResponseSchema.parse(payload);
}

export function validateExtensionGenerateRequest(payload: {
  candidateId: number;
  title?: string;
  description: string;
  sourceSite: "upwork";
  sourceUrl: string;
}) {
  return extensionGenerateRequestSchema.parse(payload);
}

export function parseExtensionGenerateResponse(payload: unknown) {
  return extensionGenerateResponseSchema.parse(payload);
}

export function parseExtensionGenerateStatusResponse(payload: unknown) {
  return extensionGenerateStatusResponseSchema.parse(payload);
}
