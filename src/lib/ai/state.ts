import type { AnalyzerOutput, CriticOutput } from "./schemas";

export interface RagContextItem {
  rawJobId?: string;
  proposalId?: string;
  styleProfileId?: string;
  jobTitle?: string;
  jobText: string;
  proposalText: string;
  techStack?: string[];
  styleProfile?: {
    formality: number;
    enthusiasm: number;
    keyVocabulary: string[];
    sentenceStructure: string;
  };
  similarity?: number;
}

export interface ProposalGraphState {
  newJobDescription: string;
  authorName?: string | null;
  ragContext: RagContextItem[];
  styleProfile: AnalyzerOutput | null;
  proposalDraft: string;
  criticFeedback: CriticOutput | null;
  revisionCount: number;
  maxRevisions: number;
  executionTrace: string[];
}

export const defaultMaxRevisions = 2;

export function createInitialState(newJobDescription: string): ProposalGraphState {
  return {
    newJobDescription,
    authorName: null,
    ragContext: [],
    styleProfile: null,
    proposalDraft: "",
    criticFeedback: null,
    revisionCount: 0,
    maxRevisions: defaultMaxRevisions,
    executionTrace: []
  };
}
