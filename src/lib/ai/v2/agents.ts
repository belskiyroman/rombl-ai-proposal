import { getLLM, type LLMFactoryOptions } from "../models";
import { ensureRuntimeGlobals } from "../runtime-polyfills";
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
  v2CandidateEvidenceSystemPrompt,
  v2CriticSystemPrompt,
  v2EvidenceSelectionSystemPrompt,
  v2JobExtractorSystemPrompt,
  v2JobUnderstandingSystemPrompt,
  v2ProposalExtractorSystemPrompt,
  v2ProposalPlanningSystemPrompt,
  v2QualityScorerSystemPrompt,
  v2RevisionSystemPrompt,
  v2WriterSystemPrompt
} from "./prompts";

export interface StructuredInvoker<T> {
  invoke: (prompt: string) => Promise<T>;
}

export interface TextInvoker {
  invoke: (prompt: string) => Promise<string>;
}

export interface ProposalEngineV2Runners {
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

export interface ProposalEngineV2ModelOptions extends Pick<LLMFactoryOptions, "fastModel" | "reasoningModel"> {}

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

export function buildJobExtractPrompt(input: { jobTitle: string; jobDescription: string }): string {
  return `${v2JobExtractorSystemPrompt}

Job title:
${input.jobTitle}

Job description:
${input.jobDescription}`;
}

export function buildProposalExtractPrompt(input: { proposalText: string; relatedJobSummary?: string }): string {
  return `${v2ProposalExtractorSystemPrompt}

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
  return `${v2QualityScorerSystemPrompt}

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
  return `${v2CandidateEvidenceSystemPrompt}

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
  return `${v2JobUnderstandingSystemPrompt}

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

  return `${v2EvidenceSelectionSystemPrompt}

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
  return `${v2ProposalPlanningSystemPrompt}

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
  return `${v2WriterSystemPrompt}

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
  return `${v2CriticSystemPrompt}

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
  return `${v2RevisionSystemPrompt}

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

export function createProposalEngineV2Runners(
  modelOptions: ProposalEngineV2ModelOptions = {}
): ProposalEngineV2Runners {
  ensureRuntimeGlobals();

  const fastModel = getLLM("fast", modelOptions);
  const reasoningModel = getLLM("reasoning", modelOptions);

  return {
    extractJob: {
      invoke: (prompt) => fastModel.withStructuredOutput(jobExtractSchema, { name: "JobExtract" }).invoke(prompt)
    },
    extractProposal: {
      invoke: (prompt) =>
        fastModel.withStructuredOutput(proposalExtractSchema, { name: "ProposalExtract" }).invoke(prompt)
    },
    scoreCaseQuality: {
      invoke: (prompt) => fastModel.withStructuredOutput(caseQualitySchema, { name: "CaseQuality" }).invoke(prompt)
    },
    extractCandidateEvidence: {
      invoke: (prompt) =>
        fastModel
          .withStructuredOutput(candidateEvidenceExtractionSchema, { name: "CandidateEvidenceExtraction" })
          .invoke(prompt) as Promise<CandidateEvidenceExtraction>
    },
    understandJob: {
      invoke: (prompt) =>
        fastModel.withStructuredOutput(jobUnderstandingSchema, { name: "JobUnderstanding" }).invoke(prompt)
    },
    selectEvidence: {
      invoke: (prompt) =>
        fastModel
          .withStructuredOutput(evidenceSelectionOutputSchema, { name: "EvidenceSelectionOutput" })
          .invoke(prompt)
    },
    planProposal: {
      invoke: (prompt) =>
        fastModel.withStructuredOutput(proposalPlanSchema, { name: "ProposalPlan" }).invoke(prompt)
    },
    critiqueDraft: {
      invoke: (prompt) =>
        fastModel.withStructuredOutput(draftCritiqueSchema, { name: "DraftCritique" }).invoke(prompt)
    },
    writeDraft: {
      invoke: async (prompt) => {
        const response = await reasoningModel.invoke(prompt);
        return normalizeAiContent(response.content);
      }
    },
    reviseDraft: {
      invoke: async (prompt) => {
        const response = await reasoningModel.invoke(prompt);
        return normalizeAiContent(response.content);
      }
    }
  };
}
