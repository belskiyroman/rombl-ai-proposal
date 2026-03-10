import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";

import {
  buildCritiquePrompt,
  buildEvidenceSelectionPrompt,
  buildJobUnderstandingPrompt,
  buildProposalPlanPrompt,
  buildRevisionPrompt,
  buildWriterPrompt,
  type ProposalEngineV2Runners
} from "./agents";
import type { CopyRisk, DraftCritique, JobUnderstanding, ProposalPlan } from "./schemas";
import type { RetrievedContextBundle } from "./state";
import type { ProposalEngineV2State } from "./state";

export const ProposalEngineV2StateAnnotation = Annotation.Root({
  candidateProfile: Annotation<ProposalEngineV2State["candidateProfile"]>,
  jobInput: Annotation<ProposalEngineV2State["jobInput"]>,
  jobUnderstanding: Annotation<JobUnderstanding | null>,
  retrievedContext: Annotation<RetrievedContextBundle | null>,
  selectedEvidence: Annotation<ProposalEngineV2State["selectedEvidence"]>,
  proposalPlan: Annotation<ProposalPlan | null>,
  currentDraft: Annotation<string>,
  draftHistory: Annotation<string[]>,
  latestCritique: Annotation<DraftCritique | null>,
  critiqueHistory: Annotation<DraftCritique[]>,
  copyRisk: Annotation<CopyRisk | null>,
  finalProposal: Annotation<string>,
  revisionCount: Annotation<number>,
  maxRevisions: Annotation<number>,
  executionTrace: Annotation<string[]>
});

export interface ProposalEngineV2GraphDependencies {
  runners: ProposalEngineV2Runners;
  retrieveContext: (args: {
    candidateId: number;
    jobUnderstanding: JobUnderstanding;
  }) => Promise<RetrievedContextBundle>;
  assessCopyRisk: (args: {
    draft: string;
    retrievedContext: RetrievedContextBundle;
  }) => CopyRisk;
}

function appendTrace(state: ProposalEngineV2State, step: string): string[] {
  return [...state.executionTrace, step];
}

function ensureProposalContext(state: ProposalEngineV2State): {
  jobUnderstanding: JobUnderstanding;
  retrievedContext: RetrievedContextBundle;
  proposalPlan: ProposalPlan;
} {
  if (!state.jobUnderstanding || !state.retrievedContext || !state.proposalPlan) {
    throw new Error("Proposal graph is missing required context.");
  }

  return {
    jobUnderstanding: state.jobUnderstanding,
    retrievedContext: state.retrievedContext,
    proposalPlan: state.proposalPlan
  };
}

async function jobUnderstandingNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  const jobUnderstanding = await dependencies.runners.understandJob.invoke(
    buildJobUnderstandingPrompt({
      title: state.jobInput.title,
      description: state.jobInput.description,
      candidateProfileSummary: state.candidateProfile.positioningSummary
    })
  );

  return {
    ...state,
    jobUnderstanding,
    executionTrace: appendTrace(state, "job_understanding")
  };
}

async function retrieveContextNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  if (!state.jobUnderstanding) {
    throw new Error("retrieve_context requires jobUnderstanding.");
  }

  const retrievedContext = await dependencies.retrieveContext({
    candidateId: state.candidateProfile.candidateId,
    jobUnderstanding: state.jobUnderstanding
  });

  return {
    ...state,
    retrievedContext,
    executionTrace: appendTrace(state, "retrieve_context")
  };
}

async function selectEvidenceNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  if (!state.jobUnderstanding || !state.retrievedContext) {
    throw new Error("select_evidence requires jobUnderstanding and retrievedContext.");
  }

  const evidenceCandidates = state.retrievedContext.evidenceCandidates.map((candidate) => ({
    id: candidate._id,
    type: candidate.type,
    text: candidate.text,
    tags: candidate.tags
  }));
  const selection = await dependencies.runners.selectEvidence.invoke(
    buildEvidenceSelectionPrompt({
      jobUnderstanding: state.jobUnderstanding,
      evidenceCandidates
    })
  );

  const candidateById = new Map(
    state.retrievedContext.evidenceCandidates.map((candidate) => [candidate._id, candidate] as const)
  );

  const selectedEvidence: ProposalEngineV2State["selectedEvidence"] = [];

  for (const selected of selection.selectedEvidence) {
    const evidence = candidateById.get(selected.evidenceId);
    if (!evidence) {
      continue;
    }

    selectedEvidence.push({
      id: evidence._id,
      reason: selected.reason,
      text: evidence.text,
      type: evidence.type
    });
  }

  const fallbackEvidence = state.retrievedContext.evidenceCandidates
    .filter((candidate) => !selectedEvidence.some((selected) => selected.id === candidate._id))
    .slice(0, Math.max(0, 4 - selectedEvidence.length))
    .map((candidate) => ({
      id: candidate._id,
      reason: "Fallback deterministic evidence selection to satisfy coverage.",
      text: candidate.text,
      type: candidate.type
    }));

  return {
    ...state,
    selectedEvidence: [...selectedEvidence, ...fallbackEvidence].slice(0, 4),
    executionTrace: appendTrace(state, "select_evidence")
  };
}

async function planProposalNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  if (!state.jobUnderstanding || !state.retrievedContext) {
    throw new Error("plan_proposal requires jobUnderstanding and retrievedContext.");
  }

  const selectedFragments = [
    ...state.retrievedContext.fragments.openings,
    ...state.retrievedContext.fragments.proofs,
    ...state.retrievedContext.fragments.closings
  ];

  const proposalPlan = await dependencies.runners.planProposal.invoke(
    buildProposalPlanPrompt({
      jobUnderstanding: state.jobUnderstanding,
      selectedEvidence: state.selectedEvidence,
      similarCases: state.retrievedContext.similarCases.map((item) => ({
        id: item._id,
        hook: item.proposalExtract.hook,
        valueProposition: item.proposalExtract.valueProposition,
        tone: item.proposalExtract.tone
      })),
      fragments: selectedFragments.map((fragment) => ({
        id: fragment._id,
        type: fragment.fragmentType,
        text: fragment.text
      })),
      toneProfile: state.candidateProfile.toneProfile,
      preferredCtaStyle: state.candidateProfile.preferredCtaStyle
    })
  );

  const selectedEvidenceIds = proposalPlan.selectedEvidenceIds.filter((id) =>
    state.selectedEvidence.some((evidence) => evidence.id === id)
  );
  const selectedFragmentIds = proposalPlan.selectedFragmentIds.filter((id) =>
    selectedFragments.some((fragment) => fragment._id === id)
  );

  return {
    ...state,
    proposalPlan: {
      ...proposalPlan,
      selectedEvidenceIds:
        selectedEvidenceIds.length > 0 ? selectedEvidenceIds : state.selectedEvidence.map((evidence) => evidence.id),
      selectedFragmentIds:
        selectedFragmentIds.length > 0 ? selectedFragmentIds : selectedFragments.map((fragment) => fragment._id)
    },
    executionTrace: appendTrace(state, "plan_proposal")
  };
}

async function writeDraftNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  const selectedFragments = [
    ...retrievedContext.fragments.openings,
    ...retrievedContext.fragments.proofs,
    ...retrievedContext.fragments.closings
  ].filter((fragment) => proposalPlan.selectedFragmentIds.includes(fragment._id));

  const currentDraft = await dependencies.runners.writeDraft.invoke(
    buildWriterPrompt({
      displayName: state.candidateProfile.displayName,
      toneProfile: state.candidateProfile.toneProfile,
      jobUnderstanding,
      selectedEvidence: state.selectedEvidence,
      selectedFragments: selectedFragments.map((fragment) => ({
        id: fragment._id,
        type: fragment.fragmentType,
        text: fragment.text
      })),
      proposalPlan
    })
  );

  return {
    ...state,
    currentDraft,
    draftHistory: [...state.draftHistory, currentDraft],
    executionTrace: appendTrace(state, "write_draft")
  };
}

async function critiqueNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  const deterministicCopyRisk = dependencies.assessCopyRisk({
    draft: state.currentDraft,
    retrievedContext
  });

  const critique = await dependencies.runners.critiqueDraft.invoke(
    buildCritiquePrompt({
      jobUnderstanding,
      proposalPlan,
      selectedEvidence: state.selectedEvidence,
      draft: state.currentDraft,
      copyRisk: deterministicCopyRisk
    })
  );

  const latestCritique: DraftCritique = {
    ...critique,
    copyRisk: {
      ...deterministicCopyRisk,
      reasons: [...new Set([...deterministicCopyRisk.reasons, ...critique.copyRisk.reasons])]
    }
  };

  const nextRevisionCount =
    latestCritique.approvalStatus === "NEEDS_REVISION" ? state.revisionCount + 1 : state.revisionCount;
  const shouldFinalize =
    latestCritique.approvalStatus === "APPROVED" || nextRevisionCount >= state.maxRevisions;

  return {
    ...state,
    latestCritique,
    critiqueHistory: [...state.critiqueHistory, latestCritique],
    copyRisk: latestCritique.copyRisk,
    revisionCount: nextRevisionCount,
    finalProposal: shouldFinalize ? state.currentDraft : state.finalProposal,
    executionTrace: appendTrace(state, "critique")
  };
}

async function reviseIfNeededNode(
  state: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  if (!state.latestCritique) {
    throw new Error("revise_if_needed requires latestCritique.");
  }

  const selectedFragments = [
    ...retrievedContext.fragments.openings,
    ...retrievedContext.fragments.proofs,
    ...retrievedContext.fragments.closings
  ].filter((fragment) => proposalPlan.selectedFragmentIds.includes(fragment._id));

  const revisedDraft = await dependencies.runners.reviseDraft.invoke(
    buildRevisionPrompt({
      originalDraft: state.currentDraft,
      critique: state.latestCritique,
      jobUnderstanding,
      proposalPlan,
      selectedEvidence: state.selectedEvidence,
      selectedFragments: selectedFragments.map((fragment) => ({
        id: fragment._id,
        type: fragment.fragmentType,
        text: fragment.text
      }))
    })
  );

  return {
    ...state,
    currentDraft: revisedDraft,
    draftHistory: [...state.draftHistory, revisedDraft],
    executionTrace: appendTrace(state, "revise_if_needed")
  };
}

function routeAfterCritique(state: ProposalEngineV2State): "revise_if_needed" | typeof END {
  if (!state.latestCritique) {
    return END;
  }

  if (state.latestCritique.approvalStatus === "NEEDS_REVISION" && state.revisionCount < state.maxRevisions) {
    return "revise_if_needed";
  }

  return END;
}

export function createProposalEngineV2Graph(dependencies: ProposalEngineV2GraphDependencies) {
  return new StateGraph(ProposalEngineV2StateAnnotation)
    .addNode("job_understanding", (state: ProposalEngineV2State) => jobUnderstandingNode(state, dependencies))
    .addNode("retrieve_context", (state: ProposalEngineV2State) => retrieveContextNode(state, dependencies))
    .addNode("select_evidence", (state: ProposalEngineV2State) => selectEvidenceNode(state, dependencies))
    .addNode("plan_proposal", (state: ProposalEngineV2State) => planProposalNode(state, dependencies))
    .addNode("write_draft", (state: ProposalEngineV2State) => writeDraftNode(state, dependencies))
    .addNode("critique", (state: ProposalEngineV2State) => critiqueNode(state, dependencies))
    .addNode("revise_if_needed", (state: ProposalEngineV2State) => reviseIfNeededNode(state, dependencies))
    .addEdge(START, "job_understanding")
    .addEdge("job_understanding", "retrieve_context")
    .addEdge("retrieve_context", "select_evidence")
    .addEdge("select_evidence", "plan_proposal")
    .addEdge("plan_proposal", "write_draft")
    .addEdge("write_draft", "critique")
    .addConditionalEdges("critique", routeAfterCritique, ["revise_if_needed", END])
    .addEdge("revise_if_needed", "critique");
}

export async function runProposalEngineV2Graph(
  initialState: ProposalEngineV2State,
  dependencies: ProposalEngineV2GraphDependencies
): Promise<ProposalEngineV2State> {
  const graph = createProposalEngineV2Graph(dependencies).compile({
    name: "structured_proposal_engine_v2"
  });

  return graph.invoke(initialState);
}
