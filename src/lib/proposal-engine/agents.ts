import type { BaseMessage } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";

import { getLLM, type LLMFactoryOptions } from "../ai/models";
import { ensureRuntimeGlobals } from "../ai/runtime-polyfills";
import { extractMessageTokenUsage, type GenerationStepTelemetry } from "../ai/telemetry";
import {
  candidateEvidenceExtractionSchema,
  caseQualitySchema,
  draftCritiqueSchema,
  evidenceSelectionOutputSchema,
  jobExtractSchema,
  jobUnderstandingSchema,
  proposalExtractSchema,
  proposalPlanSchema,
  type CandidateEvidenceExtraction,
  type CaseQuality,
  type DraftCritique,
  type EvidenceSelectionOutput,
  type JobExtract,
  type JobUnderstanding,
  type ProposalExtract,
  type ProposalPlan
} from "./schemas";
import {
  candidateEvidenceSystemPrompt,
  criticSystemPrompt,
  evidenceSelectionSystemPrompt,
  jobExtractorSystemPrompt,
  jobUnderstandingSystemPrompt,
  proposalExtractorSystemPrompt,
  proposalPlanningSystemPrompt,
  qualityScorerSystemPrompt,
  revisionSystemPrompt,
  writerSystemPrompt
} from "./prompts";

export interface StructuredInvoker<T> {
  invoke: (prompt: string) => Promise<T>;
  invokeWithTelemetry: (prompt: string) => Promise<InvocationResult<T>>;
}

export interface TextInvoker {
  invoke: (prompt: string) => Promise<string>;
  invokeWithTelemetry: (prompt: string) => Promise<InvocationResult<string>>;
}

export interface InvocationResult<T> {
  output: T;
  telemetry: Omit<GenerationStepTelemetry, "step" | "stage">;
}

export interface ProposalEngineRunners {
  extractJob: StructuredInvoker<JobExtract>;
  extractProposal: StructuredInvoker<ProposalExtract>;
  scoreCaseQuality: StructuredInvoker<CaseQuality>;
  extractCandidateEvidence: StructuredInvoker<CandidateEvidenceExtraction>;
  understandJob: StructuredInvoker<JobUnderstanding>;
  selectEvidence: StructuredInvoker<EvidenceSelectionOutput>;
  planProposal: StructuredInvoker<ProposalPlan>;
  critiqueDraft: StructuredInvoker<DraftCritique>;
  writeDraft: TextInvoker;
  reviseDraft: TextInvoker;
}

export interface ProposalEngineModelOptions extends Partial<Pick<LLMFactoryOptions, "fastModel" | "reasoningModel">> {}

function normalizeAiContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function getModelName(model: { model?: string }): string {
  return typeof model.model === "string" && model.model.trim() ? model.model : "unknown";
}

function buildInvocationTelemetry(args: {
  kind: GenerationStepTelemetry["kind"];
  model?: string;
  startedAt: number;
  finishedAt: number;
  rawMessage?: unknown;
}): Omit<GenerationStepTelemetry, "step" | "stage"> {
  return {
    kind: args.kind,
    model: args.model,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    durationMs: args.finishedAt - args.startedAt,
    tokenUsage: extractMessageTokenUsage(args.rawMessage) ?? undefined
  };
}

function createStructuredInvoker<T>(args: {
  model: ReturnType<typeof getLLM>;
  schema: any;
  name: string;
}): StructuredInvoker<T> {
  const modelName = getModelName(args.model);
  const runnable = args.model.withStructuredOutput(args.schema, {
    name: args.name,
    includeRaw: true
  }) as Runnable<string, { raw: BaseMessage; parsed: T }>;

  return {
    invoke: async (prompt) => {
      const result = await runnable.invoke(prompt);
      return result.parsed;
    },
    invokeWithTelemetry: async (prompt) => {
      const startedAt = Date.now();
      const result = await runnable.invoke(prompt);
      const finishedAt = Date.now();

      return {
        output: result.parsed,
        telemetry: buildInvocationTelemetry({
          kind: "llm",
          model: modelName,
          startedAt,
          finishedAt,
          rawMessage: result.raw
        })
      };
    }
  };
}

function createTextInvoker(model: ReturnType<typeof getLLM>): TextInvoker {
  const modelName = getModelName(model);

  return {
    invoke: async (prompt) => {
      const response = await model.invoke(prompt);
      return normalizeAiContent(response.content);
    },
    invokeWithTelemetry: async (prompt) => {
      const startedAt = Date.now();
      const response = await model.invoke(prompt);
      const finishedAt = Date.now();

      return {
        output: normalizeAiContent(response.content),
        telemetry: buildInvocationTelemetry({
          kind: "llm",
          model: modelName,
          startedAt,
          finishedAt,
          rawMessage: response
        })
      };
    }
  };
}

export function buildJobExtractPrompt(input: { jobTitle: string; jobDescription: string }): string {
  return `${jobExtractorSystemPrompt}

Job title:
${input.jobTitle}

Job description:
${input.jobDescription}`;
}

export function buildProposalExtractPrompt(input: { proposalText: string; relatedJobSummary?: string }): string {
  return `${proposalExtractorSystemPrompt}

Related job summary:
${input.relatedJobSummary ?? "Unavailable"}

Proposal text:
${input.proposalText}`;
}

export function buildCaseQualityPrompt(input: {
  jobExtract: JobExtract;
  proposalExtract: ProposalExtract;
  proposalText: string;
}): string {
  return `${qualityScorerSystemPrompt}

Job extract:
${JSON.stringify(input.jobExtract, null, 2)}

Proposal extract:
${JSON.stringify(input.proposalExtract, null, 2)}

Proposal text:
${input.proposalText}`;
}

export function buildCandidateEvidencePrompt(input: {
  candidateSummary: string;
  displayName?: string;
  knownDomains?: string[];
}): string {
  return `${candidateEvidenceSystemPrompt}

Candidate:
${input.displayName ?? "Unknown"}

Known domains:
${input.knownDomains?.join(", ") || "None provided"}

Profile / evidence notes:
${input.candidateSummary}`;
}

export function buildJobUnderstandingPrompt(input: {
  title?: string;
  description: string;
  candidateProfileSummary: string;
}): string {
  return `${jobUnderstandingSystemPrompt}

Candidate positioning summary:
${input.candidateProfileSummary}

Job title:
${input.title ?? "Untitled"}

Job description:
${input.description}`;
}

export function buildEvidenceSelectionPrompt(input: {
  jobUnderstanding: JobUnderstanding;
  evidenceCandidates: Array<{ id: string; type: string; text: string; tags: string[] }>;
}): string {
  const evidenceBlock = input.evidenceCandidates
    .map(
      (candidate) =>
        `Evidence ${candidate.id}
Type: ${candidate.type}
Tags: ${candidate.tags.join(", ") || "None"}
Text: ${candidate.text}`
    )
    .join("\n\n");

  return `${evidenceSelectionSystemPrompt}

Job understanding:
${JSON.stringify(input.jobUnderstanding, null, 2)}

Evidence candidates:
${evidenceBlock}`;
}

export function buildProposalPlanPrompt(input: {
  jobUnderstanding: JobUnderstanding;
  selectedEvidence: Array<{ id: string; text: string; type: string }>;
  similarCases: Array<{ id: string; hook: string; valueProposition: string; tone: string }>;
  fragments: Array<{ id: string; type: string; text: string }>;
  toneProfile: string;
  preferredCtaStyle: string;
}): string {
  return `${proposalPlanningSystemPrompt}

Tone profile:
${input.toneProfile}

Preferred CTA style:
${input.preferredCtaStyle}

Job understanding:
${JSON.stringify(input.jobUnderstanding, null, 2)}

Selected evidence:
${JSON.stringify(input.selectedEvidence, null, 2)}

Similar canonical cases:
${JSON.stringify(input.similarCases, null, 2)}

Reusable fragments:
${JSON.stringify(input.fragments, null, 2)}`;
}

export function buildWriterPrompt(input: {
  displayName: string;
  toneProfile: string;
  jobUnderstanding: JobUnderstanding;
  selectedEvidence: Array<{ id: string; text: string; type: string }>;
  selectedFragments: Array<{ id: string; type: string; text: string }>;
  proposalPlan: ProposalPlan;
}): string {
  return `${writerSystemPrompt}

Candidate:
${input.displayName}

Tone profile:
${input.toneProfile}

Job understanding:
${JSON.stringify(input.jobUnderstanding, null, 2)}

Selected evidence:
${JSON.stringify(input.selectedEvidence, null, 2)}

Selected reusable fragments:
${JSON.stringify(input.selectedFragments, null, 2)}

Proposal plan:
${JSON.stringify(input.proposalPlan, null, 2)}

Rules:
- Do not invent projects, outcomes, certifications, domains, or team size.
- Use only facts present in selected evidence.
- Do not copy fragment text verbatim.
- Keep the proposal specific and natural.
- End with a concise CTA aligned with the plan.

Write only the final proposal in markdown.`;
}

export function buildCritiquePrompt(input: {
  jobUnderstanding: JobUnderstanding;
  proposalPlan: ProposalPlan;
  selectedEvidence: Array<{ id: string; text: string; type: string }>;
  draft: string;
  copyRisk: { triggered: boolean; reasons: string[]; maxParagraphCosine: number; trigramOverlap: number };
}): string {
  return `${criticSystemPrompt}

Job understanding:
${JSON.stringify(input.jobUnderstanding, null, 2)}

Proposal plan:
${JSON.stringify(input.proposalPlan, null, 2)}

Selected evidence:
${JSON.stringify(input.selectedEvidence, null, 2)}

Deterministic copy-risk signal:
${JSON.stringify(input.copyRisk, null, 2)}

Draft proposal:
${input.draft}`;
}

export function buildRevisionPrompt(input: {
  originalDraft: string;
  critique: DraftCritique;
  jobUnderstanding: JobUnderstanding;
  proposalPlan: ProposalPlan;
  selectedEvidence: Array<{ id: string; text: string; type: string }>;
  selectedFragments: Array<{ id: string; type: string; text: string }>;
}): string {
  return `${revisionSystemPrompt}

Job understanding:
${JSON.stringify(input.jobUnderstanding, null, 2)}

Proposal plan:
${JSON.stringify(input.proposalPlan, null, 2)}

Selected evidence:
${JSON.stringify(input.selectedEvidence, null, 2)}

Reusable fragments:
${JSON.stringify(input.selectedFragments, null, 2)}

Current draft:
${input.originalDraft}

Critique:
${JSON.stringify(input.critique, null, 2)}

Rewrite the proposal in markdown only.`;
}

export function createProposalEngineRunners(
  modelOptions: ProposalEngineModelOptions = {}
): ProposalEngineRunners {
  ensureRuntimeGlobals();

  const fastModel = getLLM("fast", modelOptions);
  const reasoningModel = getLLM("reasoning", modelOptions);

  return {
    extractJob: createStructuredInvoker<JobExtract>({
      model: fastModel,
      schema: jobExtractSchema,
      name: "JobExtract"
    }),
    extractProposal: createStructuredInvoker<ProposalExtract>({
      model: fastModel,
      schema: proposalExtractSchema,
      name: "ProposalExtract"
    }),
    scoreCaseQuality: createStructuredInvoker<CaseQuality>({
      model: fastModel,
      schema: caseQualitySchema,
      name: "CaseQuality"
    }),
    extractCandidateEvidence: createStructuredInvoker<CandidateEvidenceExtraction>({
      model: fastModel,
      schema: candidateEvidenceExtractionSchema,
      name: "CandidateEvidenceExtraction"
    }),
    understandJob: createStructuredInvoker<JobUnderstanding>({
      model: fastModel,
      schema: jobUnderstandingSchema,
      name: "JobUnderstanding"
    }),
    selectEvidence: createStructuredInvoker<EvidenceSelectionOutput>({
      model: fastModel,
      schema: evidenceSelectionOutputSchema,
      name: "EvidenceSelectionOutput"
    }),
    planProposal: createStructuredInvoker<ProposalPlan>({
      model: fastModel,
      schema: proposalPlanSchema,
      name: "ProposalPlan"
    }),
    critiqueDraft: createStructuredInvoker<DraftCritique>({
      model: fastModel,
      schema: draftCritiqueSchema,
      name: "DraftCritique"
    }),
    writeDraft: createTextInvoker(reasoningModel),
    reviseDraft: createTextInvoker(reasoningModel)
  };
}
