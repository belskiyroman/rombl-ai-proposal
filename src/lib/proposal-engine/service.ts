import { assessCopyRisk, type CopyRiskReference } from "./copy-risk";
import type { GenerateEmbeddingResult } from "../ai/embeddings";
import { summarizeTelemetry, type GenerationStepTelemetry, type GenerationTelemetrySummary } from "../ai/telemetry";
import { deterministicallyReduceCoverLetter, getProposalLengthBudget } from "./length";
import type { ProposalEngineProgressEvent } from "./progress";
import { rerankHistoricalCases, selectEvidenceSignals, selectFragmentSignals, type RetrievedEvidence, type RetrievedFragment, type RetrievedHistoricalCase, type VectorScoreMatch } from "./retrieval";
import { maxProposalCoverLetterChars, type GenerationJobInput, type JobUnderstanding } from "./schemas";
import { createProposalEngineInitialState, defaultMaxProposalRevisions, type CandidateProfileSummary, type ProposalEngineState } from "./state";
import { runProposalEngineGraph, type ProposalEngineGraphDependencies } from "./graph";

export interface CreateProposalArgs {
  candidateId: number;
  jobInput: GenerationJobInput;
  maxRevisions?: number;
}

export interface RetrievedContextDependencies {
  embed: (input: string) => Promise<GenerateEmbeddingResult>;
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

export interface CreateProposalDependencies {
  loadCandidateProfile: (candidateId: number) => Promise<CandidateProfileSummary | null>;
  retrieveContext: (args: {
    candidateId: number;
    jobUnderstanding: JobUnderstanding;
    proposalQuestions: GenerationJobInput["proposalQuestions"];
  }) => Promise<{
    retrievedContext: NonNullable<ProposalEngineState["retrievedContext"]>;
    stepTelemetry: GenerationStepTelemetry[];
  }>;
  runGraph?: (
    initialState: ProposalEngineState,
    dependencies: ProposalEngineGraphDependencies
  ) => Promise<ProposalEngineState>;
  graphDependencies: Pick<ProposalEngineGraphDependencies, "runners">;
  onProgress?: (event: ProposalEngineProgressEvent) => Promise<void> | void;
}

export interface CreateProposalResult {
  finalProposal: string;
  coverLetterCharCount: number;
  questionAnswers: ProposalEngineState["questionAnswers"];
  unresolvedQuestions: ProposalEngineState["unresolvedQuestions"];
  approvalStatus: "APPROVED" | "NEEDS_REVISION";
  critiqueHistory: ProposalEngineState["critiqueHistory"];
  executionTrace: string[];
  selectedEvidence: ProposalEngineState["selectedEvidence"];
  retrievedContext: NonNullable<ProposalEngineState["retrievedContext"]>;
  jobUnderstanding: NonNullable<ProposalEngineState["jobUnderstanding"]>;
  proposalPlan: NonNullable<ProposalEngineState["proposalPlan"]>;
  draftHistory: string[];
  copyRisk: ProposalEngineState["copyRisk"];
  stepTelemetry: GenerationStepTelemetry[];
  telemetrySummary: GenerationTelemetrySummary;
  state: ProposalEngineState;
}

export function buildNeedsVectorText(
  jobUnderstanding: JobUnderstanding,
  proposalQuestions: GenerationJobInput["proposalQuestions"] = []
): string {
  return [
    jobUnderstanding.jobSummary,
    `Needs: ${jobUnderstanding.clientNeeds.join(", ")}`,
    `Must-have skills: ${jobUnderstanding.mustHaveSkills.join(", ")}`,
    `Nice-to-have skills: ${jobUnderstanding.niceToHaveSkills.join(", ")}`,
    buildQuestionVectorText(proposalQuestions)
  ]
    .filter(Boolean)
    .join("\n");
}

function buildQuestionVectorText(proposalQuestions: GenerationJobInput["proposalQuestions"]): string {
  if (proposalQuestions.length === 0) {
    return "";
  }

  return proposalQuestions.map((question) => `Question ${question.position}: ${question.prompt}`).join("\n");
}

function uniqueIds(matches: VectorScoreMatch[]): string[] {
  return [...new Set(matches.map((match) => match.id))];
}

function buildDurationTelemetry(args: {
  step: string;
  kind: GenerationStepTelemetry["kind"];
  startedAt: number;
  finishedAt: number;
  limit?: number;
  resultCount?: number;
  fragmentType?: string;
}): GenerationStepTelemetry {
  return {
    step: args.step,
    stage: "retrieve_context",
    kind: args.kind,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    durationMs: args.finishedAt - args.startedAt,
    limit: args.limit,
    resultCount: args.resultCount,
    fragmentType: args.fragmentType
  };
}

export async function runRetrieveProposalContext(
  args: {
    candidateId: number;
    jobUnderstanding: JobUnderstanding;
    proposalQuestions: GenerationJobInput["proposalQuestions"];
  },
  dependencies: RetrievedContextDependencies
): Promise<{
  retrievedContext: NonNullable<ProposalEngineState["retrievedContext"]>;
  stepTelemetry: GenerationStepTelemetry[];
}> {
  const stepTelemetry: GenerationStepTelemetry[] = [];

  const summaryEmbeddingStartedAt = Date.now();
  const summaryEmbedding = await dependencies.embed(args.jobUnderstanding.jobSummary);
  const summaryEmbeddingFinishedAt = Date.now();
  stepTelemetry.push({
    step: "retrieve_context.embed_job_summary",
    stage: "retrieve_context",
    kind: "embedding",
    startedAt: summaryEmbeddingStartedAt,
    finishedAt: summaryEmbeddingFinishedAt,
    durationMs: summaryEmbeddingFinishedAt - summaryEmbeddingStartedAt,
    model: summaryEmbedding.telemetry.model,
    tokenUsage: summaryEmbedding.telemetry.tokenUsage
  });

  const needsVectorText = buildNeedsVectorText(args.jobUnderstanding, args.proposalQuestions);
  const needsEmbeddingStartedAt = Date.now();
  const needsEmbedding = await dependencies.embed(needsVectorText);
  const needsEmbeddingFinishedAt = Date.now();
  stepTelemetry.push({
    step: "retrieve_context.embed_needs_vector",
    stage: "retrieve_context",
    kind: "embedding",
    startedAt: needsEmbeddingStartedAt,
    finishedAt: needsEmbeddingFinishedAt,
    durationMs: needsEmbeddingFinishedAt - needsEmbeddingStartedAt,
    model: needsEmbedding.telemetry.model,
    tokenUsage: needsEmbedding.telemetry.tokenUsage
  });

  const summarySearchStartedAt = Date.now();
  const summaryMatches = await dependencies.searchHistoricalCaseSummaries(summaryEmbedding.vector, 12);
  const summarySearchFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.search_case_summaries",
      kind: "vector_search",
      startedAt: summarySearchStartedAt,
      finishedAt: summarySearchFinishedAt,
      limit: 12,
      resultCount: summaryMatches.length
    })
  );

  const needsSearchStartedAt = Date.now();
  const needsMatches = await dependencies.searchHistoricalCaseNeeds(needsEmbedding.vector, 12);
  const needsSearchFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.search_case_needs",
      kind: "vector_search",
      startedAt: needsSearchStartedAt,
      finishedAt: needsSearchFinishedAt,
      limit: 12,
      resultCount: needsMatches.length
    })
  );

  const caseIds = uniqueIds([...summaryMatches, ...needsMatches]);
  const caseLoadStartedAt = Date.now();
  const candidateCases = (await dependencies.getHistoricalCasesByIds(caseIds)).filter(
    (candidate) => candidate.candidateId === args.candidateId && candidate.canonical
  );
  const caseLoadFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.load_cases",
      kind: "query",
      startedAt: caseLoadStartedAt,
      finishedAt: caseLoadFinishedAt,
      resultCount: candidateCases.length
    })
  );
  const similarCases = rerankHistoricalCases({
    jobUnderstanding: args.jobUnderstanding,
    candidates: candidateCases,
    summaryMatches,
    needsMatches,
    limit: 3
  });

  const fragmentEmbeddingText = needsVectorText;
  const fragmentEmbeddingStartedAt = Date.now();
  const fragmentEmbedding = await dependencies.embed(fragmentEmbeddingText);
  const fragmentEmbeddingFinishedAt = Date.now();
  stepTelemetry.push({
    step: "retrieve_context.embed_fragment_query",
    stage: "retrieve_context",
    kind: "embedding",
    startedAt: fragmentEmbeddingStartedAt,
    finishedAt: fragmentEmbeddingFinishedAt,
    durationMs: fragmentEmbeddingFinishedAt - fragmentEmbeddingStartedAt,
    model: fragmentEmbedding.telemetry.model,
    tokenUsage: fragmentEmbedding.telemetry.tokenUsage
  });

  const openingSearchStartedAt = Date.now();
  const openingMatches = await dependencies.searchProposalFragments("opening", fragmentEmbedding.vector, 8);
  const openingSearchFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.search_fragments",
      kind: "vector_search",
      startedAt: openingSearchStartedAt,
      finishedAt: openingSearchFinishedAt,
      limit: 8,
      resultCount: openingMatches.length,
      fragmentType: "opening"
    })
  );

  const proofSearchStartedAt = Date.now();
  const proofMatches = await dependencies.searchProposalFragments("proof", fragmentEmbedding.vector, 12);
  const proofSearchFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.search_fragments",
      kind: "vector_search",
      startedAt: proofSearchStartedAt,
      finishedAt: proofSearchFinishedAt,
      limit: 12,
      resultCount: proofMatches.length,
      fragmentType: "proof"
    })
  );

  const closingSearchStartedAt = Date.now();
  const closingMatches = await dependencies.searchProposalFragments("closing", fragmentEmbedding.vector, 8);
  const closingSearchFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.search_fragments",
      kind: "vector_search",
      startedAt: closingSearchStartedAt,
      finishedAt: closingSearchFinishedAt,
      limit: 8,
      resultCount: closingMatches.length,
      fragmentType: "closing"
    })
  );

  const fragmentIds = uniqueIds([...openingMatches, ...proofMatches, ...closingMatches]);
  const fragmentLoadStartedAt = Date.now();
  const fragments = (await dependencies.getProposalFragmentsByIds(fragmentIds)).filter(
    (fragment) => fragment.candidateId === args.candidateId
  );
  const fragmentLoadFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.load_fragments",
      kind: "query",
      startedAt: fragmentLoadStartedAt,
      finishedAt: fragmentLoadFinishedAt,
      resultCount: fragments.length
    })
  );
  const fragmentSignals = selectFragmentSignals({
    jobUnderstanding: args.jobUnderstanding,
    fragments
  });

  const evidenceEmbeddingStartedAt = Date.now();
  const evidenceEmbedding = await dependencies.embed(fragmentEmbeddingText);
  const evidenceEmbeddingFinishedAt = Date.now();
  stepTelemetry.push({
    step: "retrieve_context.embed_evidence_query",
    stage: "retrieve_context",
    kind: "embedding",
    startedAt: evidenceEmbeddingStartedAt,
    finishedAt: evidenceEmbeddingFinishedAt,
    durationMs: evidenceEmbeddingFinishedAt - evidenceEmbeddingStartedAt,
    model: evidenceEmbedding.telemetry.model,
    tokenUsage: evidenceEmbedding.telemetry.tokenUsage
  });

  const evidenceSearchStartedAt = Date.now();
  const evidenceMatches = await dependencies.searchCandidateEvidence(evidenceEmbedding.vector, 12);
  const evidenceSearchFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.search_evidence",
      kind: "vector_search",
      startedAt: evidenceSearchStartedAt,
      finishedAt: evidenceSearchFinishedAt,
      limit: 12,
      resultCount: evidenceMatches.length
    })
  );
  const evidenceLoadStartedAt = Date.now();
  const evidenceCandidates = (await dependencies.getCandidateEvidenceByIds(uniqueIds(evidenceMatches))).filter(
    (evidence) => evidence.candidateId === args.candidateId
  );
  const evidenceLoadFinishedAt = Date.now();
  stepTelemetry.push(
    buildDurationTelemetry({
      step: "retrieve_context.load_evidence",
      kind: "query",
      startedAt: evidenceLoadStartedAt,
      finishedAt: evidenceLoadFinishedAt,
      resultCount: evidenceCandidates.length
    })
  );
  const selectedEvidenceCandidates = selectEvidenceSignals({
    jobUnderstanding: args.jobUnderstanding,
    evidenceCandidates
  });

  return {
    retrievedContext: {
      similarCases,
      fragments: fragmentSignals,
      evidenceCandidates: selectedEvidenceCandidates
    },
    stepTelemetry
  };
}

export async function runCreateProposal(
  args: CreateProposalArgs,
  dependencies: CreateProposalDependencies
): Promise<CreateProposalResult> {
  const loadCandidateProfileStartedAt = Date.now();
  await dependencies.onProgress?.({
    step: "load_candidate_profile",
    status: "started",
    attempt: 1,
    startedAt: loadCandidateProfileStartedAt
  });
  const candidateProfile = await dependencies.loadCandidateProfile(args.candidateId);
  const loadCandidateProfileFinishedAt = Date.now();
  if (!candidateProfile) {
    throw new Error(`Candidate profile ${args.candidateId} not found.`);
  }
  await dependencies.onProgress?.({
    step: "load_candidate_profile",
    status: "completed",
    attempt: 1,
    startedAt: loadCandidateProfileStartedAt,
    finishedAt: loadCandidateProfileFinishedAt,
    durationMs: loadCandidateProfileFinishedAt - loadCandidateProfileStartedAt
  });

  const initialTelemetry: GenerationStepTelemetry[] = [
    {
      step: "load_candidate_profile",
      stage: "load_candidate_profile",
      kind: "query",
      startedAt: loadCandidateProfileStartedAt,
      finishedAt: loadCandidateProfileFinishedAt,
      durationMs: loadCandidateProfileFinishedAt - loadCandidateProfileStartedAt,
      resultCount: 1
    }
  ];

  const initialState = createProposalEngineInitialState({
    candidateProfile,
    jobInput: args.jobInput,
    maxRevisions: args.maxRevisions ?? defaultMaxProposalRevisions
  });
  initialState.stepTelemetry = initialTelemetry;

  const graphDependencies: ProposalEngineGraphDependencies = {
    ...dependencies.graphDependencies,
    retrieveContext: dependencies.retrieveContext,
    onProgress: dependencies.onProgress,
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
    : await runProposalEngineGraph(initialState, graphDependencies);

  if (!state.jobUnderstanding || !state.retrievedContext || !state.proposalPlan || !state.latestCritique) {
    throw new Error("Proposal engine did not complete all required stages.");
  }

  let finalProposal = state.finalProposal || state.currentDraft;
  if (finalProposal.length > maxProposalCoverLetterChars) {
    const lengthBudget = getProposalLengthBudget(state.jobUnderstanding.proposalStrategy.length);
    const reductionStartedAt = Date.now();
    const deterministicReduction = deterministicallyReduceCoverLetter(finalProposal, lengthBudget.hardMaxChars);
    const reductionFinishedAt = Date.now();

    finalProposal = deterministicReduction.output;
    state.currentDraft = finalProposal;
    state.finalProposal = finalProposal;
    if (state.draftHistory[state.draftHistory.length - 1] !== finalProposal) {
      state.draftHistory = [...state.draftHistory, finalProposal];
    }
    state.executionTrace = [...state.executionTrace, "enforce_length.reduce"];
    state.stepTelemetry = [
      ...state.stepTelemetry,
      {
        step: `enforce_length.${deterministicReduction.strategy}`,
        stage: "length_enforcement",
        kind: "query",
        startedAt: reductionStartedAt,
        finishedAt: reductionFinishedAt,
        durationMs: reductionFinishedAt - reductionStartedAt,
        attempt: Math.max(1, state.draftHistory.length)
      }
    ];
  }

  return {
    finalProposal,
    coverLetterCharCount: finalProposal.length,
    questionAnswers: state.questionAnswers,
    unresolvedQuestions: state.unresolvedQuestions,
    approvalStatus: state.latestCritique.approvalStatus,
    critiqueHistory: state.critiqueHistory,
    executionTrace: state.executionTrace,
    selectedEvidence: state.selectedEvidence,
    retrievedContext: state.retrievedContext,
    jobUnderstanding: state.jobUnderstanding,
    proposalPlan: state.proposalPlan,
    draftHistory: state.draftHistory,
    copyRisk: state.copyRisk,
    stepTelemetry: state.stepTelemetry,
    telemetrySummary: summarizeTelemetry(state.stepTelemetry),
    state
  };
}
