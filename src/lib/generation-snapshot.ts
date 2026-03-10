import type { GenerationStepTelemetry, GenerationTelemetrySummary } from "./ai/telemetry";

export interface GenerationRunCandidateSnapshot {
  candidateId: number;
  displayName: string;
  toneProfile: string;
  preferredCtaStyle: string;
}

export interface GenerationRunCopyRisk {
  triggered: boolean;
  maxParagraphCosine: number;
  trigramOverlap: number;
  matchedCaseIds: string[];
  matchedFragmentIds: string[];
  reasons: string[];
}

export interface GenerationRunCritique {
  issues: string[];
  revisionInstructions: string[];
  approvalStatus: "APPROVED" | "NEEDS_REVISION";
  rubric: {
    relevance: number;
    specificity: number;
    credibility: number;
    tone: number;
    clarity: number;
    ctaStrength: number;
  };
  copyRisk: GenerationRunCopyRisk;
}

export interface GenerationRunSelectedEvidence {
  id: string;
  reason: string;
  text: string;
  type: string;
}

export interface GenerationRunRetrievedContext {
  similarCases: Array<{
    _id: string;
    jobTitle: string;
    canonical: boolean;
    clusterId?: string | null;
    candidateId: number;
    jobExtract: {
      projectType: string;
      domain: string;
      requiredSkills: string[];
      optionalSkills: string[];
      stack: string[];
      clientNeeds: string[];
      summary: string;
    };
    proposalExtract: {
      hook: string;
      valueProposition: string;
      proofPoints: string[];
      tone: string;
    };
    finalScore?: number;
    semanticScore?: number;
  }>;
  fragments: {
    openings: Array<{ _id: string; text: string; fragmentType: string; clusterId?: string | null }>;
    proofs: Array<{ _id: string; text: string; fragmentType: string; clusterId?: string | null }>;
    closings: Array<{ _id: string; text: string; fragmentType: string; clusterId?: string | null }>;
  };
  evidenceCandidates: Array<{
    _id: string;
    text: string;
    type: string;
    tags: string[];
    techStack: string[];
    domains: string[];
    confidence: number;
    source: string;
    active: boolean;
  }>;
}

export interface GenerationSnapshotData {
  generationRunId: string;
  candidateSnapshot: GenerationRunCandidateSnapshot;
  jobInput: {
    title?: string;
    description: string;
  };
  finalProposal: string;
  approvalStatus: "APPROVED" | "NEEDS_REVISION";
  critiqueHistory: GenerationRunCritique[];
  executionTrace: string[];
  stepTelemetry: GenerationStepTelemetry[];
  telemetrySummary: GenerationTelemetrySummary;
  selectedEvidence: GenerationRunSelectedEvidence[];
  retrievedContext: GenerationRunRetrievedContext;
  jobUnderstanding: {
    jobSummary: string;
    clientNeeds: string[];
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    projectRiskFlags: string[];
    proposalStrategy: {
      tone: string;
      length: string;
      focus: string[];
    };
  };
  proposalPlan: {
    openingAngle: string;
    mainPoints: string[];
    selectedEvidenceIds: string[];
    selectedFragmentIds: string[];
    avoid: string[];
    ctaStyle: string;
  };
  draftHistory: string[];
  copyRisk: GenerationRunCopyRisk;
  createdAt: number;
}

export interface GenerationHistoryListItem {
  _id: string;
  candidateId: number;
  createdAt: number;
  approvalStatus: "APPROVED" | "NEEDS_REVISION";
  jobTitle: string;
  jobSummary: string;
  finalProposalPreview: string;
  revisionCount: number;
  copyRiskTriggered: boolean;
}
