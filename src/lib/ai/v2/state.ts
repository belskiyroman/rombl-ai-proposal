import type {
  CopyRisk,
  DraftCritique,
  EvidenceType,
  GenerationJobInput,
  JobUnderstanding,
  ProposalPlan
} from "./schemas";
import type { RetrievedEvidence, RetrievedFragment, RetrievedHistoricalCase } from "./retrieval";

export interface CandidateProfileSummary {
  candidateId: number;
  displayName: string;
  positioningSummary: string;
  toneProfile: string;
  coreDomains: string[];
  preferredCtaStyle: string;
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

export interface ProposalEngineV2State {
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
  revisionCount: number;
  maxRevisions: number;
  executionTrace: string[];
}

export const defaultMaxProposalRevisions = 2;

export function createProposalEngineV2InitialState(input: {
  candidateProfile: CandidateProfileSummary;
  jobInput: GenerationJobInput;
  maxRevisions?: number;
}): ProposalEngineV2State {
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
    revisionCount: 0,
    maxRevisions: input.maxRevisions ?? defaultMaxProposalRevisions,
    executionTrace: []
  };
}
