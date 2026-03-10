import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";

import {
  buildCritiquePrompt,
  buildEvidenceSelectionPrompt,
  buildJobUnderstandingPrompt,
  buildProposalPlanPrompt,
  buildRevisionPrompt,
  buildWriterPrompt,
  type ProposalEngineRunners
} from "./agents";
import type { GenerationStepTelemetry } from "../ai/telemetry";
import type { CopyRisk, DraftCritique, JobUnderstanding, ProposalPlan } from "./schemas";
import type { RetrievedContextBundle } from "./state";
import type { ProposalEngineState } from "./state";

export const ProposalEngineStateAnnotation = Annotation.Root({
  candidateProfile: Annotation<ProposalEngineState["candidateProfile"]>,
  jobInput: Annotation<ProposalEngineState["jobInput"]>,
  jobUnderstanding: Annotation<JobUnderstanding | null>,
  retrievedContext: Annotation<RetrievedContextBundle | null>,
  selectedEvidence: Annotation<ProposalEngineState["selectedEvidence"]>,
  proposalPlan: Annotation<ProposalPlan | null>,
  currentDraft: Annotation<string>,
  draftHistory: Annotation<string[]>,
  latestCritique: Annotation<DraftCritique | null>,
  critiqueHistory: Annotation<DraftCritique[]>,
  copyRisk: Annotation<CopyRisk | null>,
  finalProposal: Annotation<string>,
  revisionCount: Annotation<number>,
  maxRevisions: Annotation<number>,
  executionTrace: Annotation<string[]>,
  stepTelemetry: Annotation<GenerationStepTelemetry[]>
});

export interface ProposalEngineGraphDependencies {
  runners: ProposalEngineRunners;
  retrieveContext: (args: {
    candidateId: number;
    jobUnderstanding: JobUnderstanding;
  }) => Promise<{
    retrievedContext: RetrievedContextBundle;
    stepTelemetry: GenerationStepTelemetry[];
  }>;
  assessCopyRisk: (args: {
    draft: string;
    retrievedContext: RetrievedContextBundle;
  }) => CopyRisk;
}

function appendTrace(state: ProposalEngineState, step: string): string[] {
  return [...state.executionTrace, step];
}

function appendStepTelemetry(
  state: ProposalEngineState,
  telemetry: GenerationStepTelemetry | GenerationStepTelemetry[]
): GenerationStepTelemetry[] {
  return [...state.stepTelemetry, ...(Array.isArray(telemetry) ? telemetry : [telemetry])];
}

function ensureProposalContext(state: ProposalEngineState): {
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
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const jobUnderstanding = await dependencies.runners.understandJob.invokeWithTelemetry(
    buildJobUnderstandingPrompt({
      title: state.jobInput.title,
      description: state.jobInput.description,
      candidateProfileSummary: state.candidateProfile.positioningSummary
    })
  );

  return {
    ...state,
    jobUnderstanding: jobUnderstanding.output,
    executionTrace: appendTrace(state, "job_understanding"),
    stepTelemetry: appendStepTelemetry(state, {
      ...jobUnderstanding.telemetry,
      step: "job_understanding",
      stage: "job_understanding",
      attempt: 1
    })
  };
}

async function retrieveContextNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  if (!state.jobUnderstanding) {
    throw new Error("retrieve_context requires jobUnderstanding.");
  }

  const retrievedContext = await dependencies.retrieveContext({
    candidateId: state.candidateProfile.candidateId,
    jobUnderstanding: state.jobUnderstanding
  });

  return {
    ...state,
    retrievedContext: retrievedContext.retrievedContext,
    executionTrace: appendTrace(state, "retrieve_context"),
    stepTelemetry: appendStepTelemetry(state, retrievedContext.stepTelemetry)
  };
}

async function selectEvidenceNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  if (!state.jobUnderstanding || !state.retrievedContext) {
    throw new Error("select_evidence requires jobUnderstanding and retrievedContext.");
  }

  const evidenceCandidates = state.retrievedContext.evidenceCandidates.map((candidate) => ({
    id: candidate._id,
    type: candidate.type,
    text: candidate.text,
    tags: candidate.tags
  }));
  const selection = await dependencies.runners.selectEvidence.invokeWithTelemetry(
    buildEvidenceSelectionPrompt({
      jobUnderstanding: state.jobUnderstanding,
      evidenceCandidates
    })
  );

  const candidateById = new Map(
    state.retrievedContext.evidenceCandidates.map((candidate) => [candidate._id, candidate] as const)
  );

  const selectedEvidence: ProposalEngineState["selectedEvidence"] = [];

  for (const selected of selection.output.selectedEvidence) {
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
    executionTrace: appendTrace(state, "select_evidence"),
    stepTelemetry: appendStepTelemetry(state, {
      ...selection.telemetry,
      step: "select_evidence",
      stage: "select_evidence",
      attempt: 1
    })
  };
}

async function planProposalNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  if (!state.jobUnderstanding || !state.retrievedContext) {
    throw new Error("plan_proposal requires jobUnderstanding and retrievedContext.");
  }

  const selectedFragments = [
    ...state.retrievedContext.fragments.openings,
    ...state.retrievedContext.fragments.proofs,
    ...state.retrievedContext.fragments.closings
  ];

  const proposalPlan = await dependencies.runners.planProposal.invokeWithTelemetry(
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

  const selectedEvidenceIds = proposalPlan.output.selectedEvidenceIds.filter((id) =>
    state.selectedEvidence.some((evidence) => evidence.id === id)
  );
  const selectedFragmentIds = proposalPlan.output.selectedFragmentIds.filter((id) =>
    selectedFragments.some((fragment) => fragment._id === id)
  );

  return {
    ...state,
    proposalPlan: {
      ...proposalPlan.output,
      selectedEvidenceIds:
        selectedEvidenceIds.length > 0 ? selectedEvidenceIds : state.selectedEvidence.map((evidence) => evidence.id),
      selectedFragmentIds:
        selectedFragmentIds.length > 0 ? selectedFragmentIds : selectedFragments.map((fragment) => fragment._id)
    },
    executionTrace: appendTrace(state, "plan_proposal"),
    stepTelemetry: appendStepTelemetry(state, {
      ...proposalPlan.telemetry,
      step: "plan_proposal",
      stage: "plan_proposal",
      attempt: 1
    })
  };
}

async function writeDraftNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  const selectedFragments = [
    ...retrievedContext.fragments.openings,
    ...retrievedContext.fragments.proofs,
    ...retrievedContext.fragments.closings
  ].filter((fragment) => proposalPlan.selectedFragmentIds.includes(fragment._id));

  const currentDraft = await dependencies.runners.writeDraft.invokeWithTelemetry(
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
    currentDraft: currentDraft.output,
    draftHistory: [...state.draftHistory, currentDraft.output],
    executionTrace: appendTrace(state, "write_draft"),
    stepTelemetry: appendStepTelemetry(state, {
      ...currentDraft.telemetry,
      step: "write_draft",
      stage: "write_draft",
      attempt: state.draftHistory.length + 1
    })
  };
}

async function critiqueNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  const deterministicCopyRisk = dependencies.assessCopyRisk({
    draft: state.currentDraft,
    retrievedContext
  });

  const critique = await dependencies.runners.critiqueDraft.invokeWithTelemetry(
    buildCritiquePrompt({
      jobUnderstanding,
      proposalPlan,
      selectedEvidence: state.selectedEvidence,
      draft: state.currentDraft,
      copyRisk: deterministicCopyRisk
    })
  );

  const latestCritique: DraftCritique = {
    ...critique.output,
    copyRisk: {
      ...deterministicCopyRisk,
      reasons: [...new Set([...deterministicCopyRisk.reasons, ...critique.output.copyRisk.reasons])]
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
    executionTrace: appendTrace(state, "critique"),
    stepTelemetry: appendStepTelemetry(state, {
      ...critique.telemetry,
      step: "critique",
      stage: "critique",
      attempt: state.critiqueHistory.length + 1
    })
  };
}

async function reviseIfNeededNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  if (!state.latestCritique) {
    throw new Error("revise_if_needed requires latestCritique.");
  }

  const selectedFragments = [
    ...retrievedContext.fragments.openings,
    ...retrievedContext.fragments.proofs,
    ...retrievedContext.fragments.closings
  ].filter((fragment) => proposalPlan.selectedFragmentIds.includes(fragment._id));

  const revisedDraft = await dependencies.runners.reviseDraft.invokeWithTelemetry(
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
    currentDraft: revisedDraft.output,
    draftHistory: [...state.draftHistory, revisedDraft.output],
    executionTrace: appendTrace(state, "revise_if_needed"),
    stepTelemetry: appendStepTelemetry(state, {
      ...revisedDraft.telemetry,
      step: "revise_if_needed",
      stage: "revise_if_needed",
      attempt: state.revisionCount
    })
  };
}

function routeAfterCritique(state: ProposalEngineState): "revise_if_needed" | typeof END {
  if (!state.latestCritique) {
    return END;
  }

  if (state.latestCritique.approvalStatus === "NEEDS_REVISION" && state.revisionCount < state.maxRevisions) {
    return "revise_if_needed";
  }

  return END;
}

export function createProposalEngineGraph(dependencies: ProposalEngineGraphDependencies) {
  return new StateGraph(ProposalEngineStateAnnotation)
    .addNode("job_understanding", (state: ProposalEngineState) => jobUnderstandingNode(state, dependencies))
    .addNode("retrieve_context", (state: ProposalEngineState) => retrieveContextNode(state, dependencies))
    .addNode("select_evidence", (state: ProposalEngineState) => selectEvidenceNode(state, dependencies))
    .addNode("plan_proposal", (state: ProposalEngineState) => planProposalNode(state, dependencies))
    .addNode("write_draft", (state: ProposalEngineState) => writeDraftNode(state, dependencies))
    .addNode("critique", (state: ProposalEngineState) => critiqueNode(state, dependencies))
    .addNode("revise_if_needed", (state: ProposalEngineState) => reviseIfNeededNode(state, dependencies))
    .addEdge(START, "job_understanding")
    .addEdge("job_understanding", "retrieve_context")
    .addEdge("retrieve_context", "select_evidence")
    .addEdge("select_evidence", "plan_proposal")
    .addEdge("plan_proposal", "write_draft")
    .addEdge("write_draft", "critique")
    .addConditionalEdges("critique", routeAfterCritique, ["revise_if_needed", END])
    .addEdge("revise_if_needed", "critique");
}

export async function runProposalEngineGraph(
  initialState: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const graph = createProposalEngineGraph(dependencies).compile({
    name: "structured_proposal_engine"
  });

  return graph.invoke(initialState);
}
