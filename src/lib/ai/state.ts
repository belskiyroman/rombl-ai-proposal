import type { AnalyzerOutput, CriticOutput } from "./schemas";

export interface RagContextItem {
  jobText: string;
  proposalText: string;
  similarity?: number;
}

export interface ProposalGraphState {
  newJobDescription: string;
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
    ragContext: [],
    styleProfile: null,
    proposalDraft: "",
    criticFeedback: null,
    revisionCount: 0,
    maxRevisions: defaultMaxRevisions,
    executionTrace: []
  };
}
