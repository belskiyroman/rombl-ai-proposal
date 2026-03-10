import { assessCopyRisk, type CopyRiskReference } from "./copy-risk";
import { rerankHistoricalCases, selectEvidenceSignals, selectFragmentSignals, type RetrievedEvidence, type RetrievedFragment, type RetrievedHistoricalCase, type VectorScoreMatch } from "./retrieval";
import type { GenerationJobInput, JobUnderstanding } from "./schemas";
import { createProposalEngineV2InitialState, defaultMaxProposalRevisions, type CandidateProfileSummary, type ProposalEngineV2State } from "./state";
import { runProposalEngineV2Graph, type ProposalEngineV2GraphDependencies } from "./graph";

export interface CreateProposalV2Args {
  candidateId: number;
  jobInput: GenerationJobInput;
  maxRevisions?: number;
}

export interface RetrievedContextDependencies {
  embed: (input: string) => Promise<number[]>;
  searchHistoricalCaseSummaries: (embedding: number[], limit: number) => Promise<VectorScoreMatch[]>;
  searchHistoricalCaseNeeds: (embedding: number[], limit: number) => Promise<VectorScoreMatch[]>;
  searchProposalFragments: (
    fragmentType: "opening" | "proof" | "closing",
    embedding: number[],
    limit: number
  ) => Promise<VectorScoreMatch[]>;
  searchCandidateEvidence: (embedding: number[], limit: number) => Promise<VectorScoreMatch[]>;
  getHistoricalCasesByIds: (ids: string[]) => Promise<RetrievedHistoricalCase[]>;
  getProposalFragmentsByIds: (ids: string[]) => Promise<RetrievedFragment[]>;
  getCandidateEvidenceByIds: (ids: string[]) => Promise<RetrievedEvidence[]>;
}

export interface CreateProposalV2Dependencies {
  loadCandidateProfile: (candidateId: number) => Promise<CandidateProfileSummary | null>;
  retrieveContext: (args: {
    candidateId: number;
    jobUnderstanding: JobUnderstanding;
  }) => Promise<NonNullable<ProposalEngineV2State["retrievedContext"]>>;
  runGraph?: (
    initialState: ProposalEngineV2State,
    dependencies: ProposalEngineV2GraphDependencies
  ) => Promise<ProposalEngineV2State>;
  graphDependencies: Pick<ProposalEngineV2GraphDependencies, "runners">;
}

export interface CreateProposalV2Result {
  finalProposal: string;
  approvalStatus: "APPROVED" | "NEEDS_REVISION";
  critiqueHistory: ProposalEngineV2State["critiqueHistory"];
  executionTrace: string[];
  selectedEvidence: ProposalEngineV2State["selectedEvidence"];
  retrievedContext: NonNullable<ProposalEngineV2State["retrievedContext"]>;
  jobUnderstanding: NonNullable<ProposalEngineV2State["jobUnderstanding"]>;
  proposalPlan: NonNullable<ProposalEngineV2State["proposalPlan"]>;
  draftHistory: string[];
  copyRisk: ProposalEngineV2State["copyRisk"];
  state: ProposalEngineV2State;
}

export function buildNeedsVectorText(jobUnderstanding: JobUnderstanding): string {
  return [
    jobUnderstanding.jobSummary,
    `Needs: ${jobUnderstanding.clientNeeds.join(", ")}`,
    `Must-have skills: ${jobUnderstanding.mustHaveSkills.join(", ")}`,
    `Nice-to-have skills: ${jobUnderstanding.niceToHaveSkills.join(", ")}`
  ]
    .filter(Boolean)
    .join("\n");
}

function uniqueIds(matches: VectorScoreMatch[]): string[] {
  return [...new Set(matches.map((match) => match.id))];
}

export async function runRetrieveProposalContextV2(
  args: {
    candidateId: number;
    jobUnderstanding: JobUnderstanding;
  },
  dependencies: RetrievedContextDependencies
): Promise<NonNullable<ProposalEngineV2State["retrievedContext"]>> {
  const [summaryEmbedding, needsEmbedding] = await Promise.all([
    dependencies.embed(args.jobUnderstanding.jobSummary),
    dependencies.embed(buildNeedsVectorText(args.jobUnderstanding))
  ]);

  const [summaryMatches, needsMatches] = await Promise.all([
    dependencies.searchHistoricalCaseSummaries(summaryEmbedding, 12),
    dependencies.searchHistoricalCaseNeeds(needsEmbedding, 12)
  ]);

  const caseIds = uniqueIds([...summaryMatches, ...needsMatches]);
  const candidateCases = (await dependencies.getHistoricalCasesByIds(caseIds)).filter(
    (candidate) => candidate.candidateId === args.candidateId && candidate.canonical
  );
  const similarCases = rerankHistoricalCases({
    jobUnderstanding: args.jobUnderstanding,
    candidates: candidateCases,
    summaryMatches,
    needsMatches,
    limit: 3
  });

  const fragmentEmbeddingText = buildNeedsVectorText(args.jobUnderstanding);
  const fragmentEmbedding = await dependencies.embed(fragmentEmbeddingText);
  const [openingMatches, proofMatches, closingMatches] = await Promise.all([
    dependencies.searchProposalFragments("opening", fragmentEmbedding, 8),
    dependencies.searchProposalFragments("proof", fragmentEmbedding, 12),
    dependencies.searchProposalFragments("closing", fragmentEmbedding, 8)
  ]);

  const fragmentIds = uniqueIds([...openingMatches, ...proofMatches, ...closingMatches]);
  const fragments = (await dependencies.getProposalFragmentsByIds(fragmentIds)).filter(
    (fragment) => fragment.candidateId === args.candidateId
  );
  const fragmentSignals = selectFragmentSignals({
    jobUnderstanding: args.jobUnderstanding,
    fragments
  });

  const evidenceEmbedding = await dependencies.embed(fragmentEmbeddingText);
  const evidenceMatches = await dependencies.searchCandidateEvidence(evidenceEmbedding, 12);
  const evidenceCandidates = (await dependencies.getCandidateEvidenceByIds(uniqueIds(evidenceMatches))).filter(
    (evidence) => evidence.candidateId === args.candidateId
  );
  const selectedEvidenceCandidates = selectEvidenceSignals({
    jobUnderstanding: args.jobUnderstanding,
    evidenceCandidates
  });

  return {
    similarCases,
    fragments: fragmentSignals,
    evidenceCandidates: selectedEvidenceCandidates
  };
}

export async function runCreateProposalV2(
  args: CreateProposalV2Args,
  dependencies: CreateProposalV2Dependencies
): Promise<CreateProposalV2Result> {
  const candidateProfile = await dependencies.loadCandidateProfile(args.candidateId);
  if (!candidateProfile) {
    throw new Error(`Candidate profile ${args.candidateId} not found.`);
  }

  const initialState = createProposalEngineV2InitialState({
    candidateProfile,
    jobInput: args.jobInput,
    maxRevisions: args.maxRevisions ?? defaultMaxProposalRevisions
  });

  const graphDependencies: ProposalEngineV2GraphDependencies = {
    ...dependencies.graphDependencies,
    retrieveContext: dependencies.retrieveContext,
    assessCopyRisk: ({ draft, retrievedContext }) => {
      const references: CopyRiskReference[] = [
        ...retrievedContext.similarCases.map((candidate) => ({
          id: candidate._id,
          type: "case" as const,
          text: candidate.proposalExtract.hook + "\n\n" + candidate.proposalExtract.valueProposition + "\n\n" + candidate.proposalExtract.proofPoints.join("\n")
        })),
        ...[
          ...retrievedContext.fragments.openings,
          ...retrievedContext.fragments.proofs,
          ...retrievedContext.fragments.closings
        ].map((fragment) => ({
          id: fragment._id,
          type: "fragment" as const,
          text: fragment.text
        }))
      ];

      return assessCopyRisk(draft, references);
    }
  };

  const state = dependencies.runGraph
    ? await dependencies.runGraph(initialState, graphDependencies)
    : await runProposalEngineV2Graph(initialState, graphDependencies);

  if (!state.jobUnderstanding || !state.retrievedContext || !state.proposalPlan || !state.latestCritique) {
    throw new Error("Proposal engine V2 did not complete all required stages.");
  }

  return {
    finalProposal: state.finalProposal || state.currentDraft,
    approvalStatus: state.latestCritique.approvalStatus,
    critiqueHistory: state.critiqueHistory,
    executionTrace: state.executionTrace,
    selectedEvidence: state.selectedEvidence,
    retrievedContext: state.retrievedContext,
    jobUnderstanding: state.jobUnderstanding,
    proposalPlan: state.proposalPlan,
    draftHistory: state.draftHistory,
    copyRisk: state.copyRisk,
    state
  };
}
