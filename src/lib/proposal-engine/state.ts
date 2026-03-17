import type {
  CopyRisk,
  DraftCritique,
  EvidenceType,
  GenerationJobInput,
  JobUnderstanding,
  ProposalQuestionAnswer,
  ProposalPlan,
  UnresolvedProposalQuestion
} from "./schemas";
import type { GenerationStepTelemetry } from "../ai/telemetry";
import type { RetrievedEvidence, RetrievedFragment, RetrievedHistoricalCase } from "./retrieval";

export interface CandidateProfileSummary {
  candidateId: number;
  displayName: string;
  positioningSummary: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
  externalProfiles: {
    githubUrl?: string;
    websiteUrl?: string;
    portfolioUrl?: string;
  };
}

export interface RetrievedContextBundle {
  similarCases: RetrievedHistoricalCase[];
  fragments: {
    openings: RetrievedFragment[];
    proofs: RetrievedFragment[];
    closings: RetrievedFragment[];
  };
  evidenceCandidates: RetrievedEvidence[];
}

export interface SelectedEvidenceItem {
  id: string;
  reason: string;
  text: string;
  type: EvidenceType;
}

export interface ProposalEngineState {
  candidateProfile: CandidateProfileSummary;
  jobInput: GenerationJobInput;
  jobUnderstanding: JobUnderstanding | null;
  retrievedContext: RetrievedContextBundle | null;
  selectedEvidence: SelectedEvidenceItem[];
  proposalPlan: ProposalPlan | null;
  currentDraft: string;
  draftHistory: string[];
  latestCritique: DraftCritique | null;
  critiqueHistory: DraftCritique[];
  copyRisk: CopyRisk | null;
  finalProposal: string;
  questionAnswers: ProposalQuestionAnswer[];
  unresolvedQuestions: UnresolvedProposalQuestion[];
  revisionCount: number;
  maxRevisions: number;
  executionTrace: string[];
  stepTelemetry: GenerationStepTelemetry[];
}

export const defaultMaxProposalRevisions = 2;

export function createProposalEngineInitialState(input: {
  candidateProfile: CandidateProfileSummary;
  jobInput: GenerationJobInput;
  maxRevisions?: number;
}): ProposalEngineState {
  return {
    candidateProfile: input.candidateProfile,
    jobInput: input.jobInput,
    jobUnderstanding: null,
    retrievedContext: null,
    selectedEvidence: [],
    proposalPlan: null,
    currentDraft: "",
    draftHistory: [],
    latestCritique: null,
    critiqueHistory: [],
    copyRisk: null,
    finalProposal: "",
    questionAnswers: [],
    unresolvedQuestions: [],
    revisionCount: 0,
    maxRevisions: input.maxRevisions ?? defaultMaxProposalRevisions,
    executionTrace: [],
    stepTelemetry: []
  };
}
