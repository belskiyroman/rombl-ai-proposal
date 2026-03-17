import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";

import {
  buildCritiquePrompt,
  buildEvidenceSelectionPrompt,
  buildJobUnderstandingPrompt,
  buildLengthCompressionPrompt,
  buildProposalPlanPrompt,
  buildQuestionAnsweringPrompt,
  buildRevisionPrompt,
  buildWriterPrompt,
  type ProposalEngineRunners
} from "./agents";
import type { GenerationStepTelemetry } from "../ai/telemetry";
import { deterministicallyReduceCoverLetter, getProposalLengthBudget } from "./length";
import {
  maxProposalCoverLetterChars,
  type CopyRisk,
  type DraftCritique,
  type JobUnderstanding,
  type ProposalPlan
} from "./schemas";
import type { ProposalEngineProgressEvent } from "./progress";
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
  questionAnswers: Annotation<ProposalEngineState["questionAnswers"]>,
  unresolvedQuestions: Annotation<ProposalEngineState["unresolvedQuestions"]>,
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
    proposalQuestions: ProposalEngineState["jobInput"]["proposalQuestions"];
  }) => Promise<{
    retrievedContext: RetrievedContextBundle;
    stepTelemetry: GenerationStepTelemetry[];
  }>;
  assessCopyRisk: (args: {
    draft: string;
    retrievedContext: RetrievedContextBundle;
  }) => CopyRisk;
  onProgress?: (event: ProposalEngineProgressEvent) => Promise<void> | void;
}

function appendTrace(state: ProposalEngineState, step: string): string[] {
  return [...state.executionTrace, step];
}

function appendTraceEntries(state: ProposalEngineState, steps: string[]): string[] {
  return [...state.executionTrace, ...steps];
}

async function notifyProgress(
  dependencies: ProposalEngineGraphDependencies,
  event: ProposalEngineProgressEvent
): Promise<void> {
  await dependencies.onProgress?.(event);
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

function getSelectedFragments(retrievedContext: RetrievedContextBundle, proposalPlan: ProposalPlan) {
  return [
    ...retrievedContext.fragments.openings,
    ...retrievedContext.fragments.proofs,
    ...retrievedContext.fragments.closings
  ].filter((fragment) => proposalPlan.selectedFragmentIds.includes(fragment._id));
}

async function jobUnderstandingNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "job_understanding",
    status: "started",
    attempt: 1,
    startedAt: progressStartedAt
  });

  const jobUnderstanding = await dependencies.runners.understandJob.invokeWithTelemetry(
    buildJobUnderstandingPrompt({
      title: state.jobInput.title,
      description: state.jobInput.description,
      proposalQuestions: state.jobInput.proposalQuestions,
      candidateProfileSummary: state.candidateProfile.positioningSummary
    })
  );
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "job_understanding",
    status: "completed",
    attempt: 1,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

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

  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "retrieve_context",
    status: "started",
    attempt: 1,
    startedAt: progressStartedAt
  });

  const retrievedContext = await dependencies.retrieveContext({
    candidateId: state.candidateProfile.candidateId,
    jobUnderstanding: state.jobUnderstanding,
    proposalQuestions: state.jobInput.proposalQuestions
  });
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "retrieve_context",
    status: "completed",
    attempt: 1,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
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

  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "select_evidence",
    status: "started",
    attempt: 1,
    startedAt: progressStartedAt
  });

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
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "select_evidence",
    status: "completed",
    attempt: 1,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

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

  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "plan_proposal",
    status: "started",
    attempt: 1,
    startedAt: progressStartedAt
  });

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
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "plan_proposal",
    status: "completed",
    attempt: 1,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

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
  const attempt = state.draftHistory.length + 1;
  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "write_draft",
    status: "started",
    attempt,
    startedAt: progressStartedAt
  });
  const selectedFragments = getSelectedFragments(retrievedContext, proposalPlan);
  const lengthBudget = getProposalLengthBudget(jobUnderstanding.proposalStrategy.length);

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
      proposalPlan,
      softTargetChars: lengthBudget.softTargetChars,
      hardMaxChars: lengthBudget.hardMaxChars
    })
  );
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "write_draft",
    status: "completed",
    attempt,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

  return {
    ...state,
    currentDraft: currentDraft.output,
    draftHistory: [...state.draftHistory, currentDraft.output],
    executionTrace: appendTrace(state, "write_draft"),
    stepTelemetry: appendStepTelemetry(state, {
      ...currentDraft.telemetry,
      step: "write_draft",
      stage: "write_draft",
      attempt
    })
  };
}

async function enforceLengthNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const { jobUnderstanding, proposalPlan } = ensureProposalContext(state);
  const attempt = Math.max(1, state.draftHistory.length);
  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "enforce_length",
    status: "started",
    attempt,
    startedAt: progressStartedAt
  });

  const lengthBudget = getProposalLengthBudget(jobUnderstanding.proposalStrategy.length);

  if (state.currentDraft.length <= lengthBudget.hardMaxChars) {
    const progressFinishedAt = Date.now();
    await notifyProgress(dependencies, {
      step: "enforce_length",
      status: "completed",
      attempt,
      startedAt: progressStartedAt,
      finishedAt: progressFinishedAt,
      durationMs: progressFinishedAt - progressStartedAt
    });

    return {
      ...state,
      executionTrace: appendTrace(state, "enforce_length.noop"),
      stepTelemetry: appendStepTelemetry(state, {
        step: "enforce_length.noop",
        stage: "length_enforcement",
        kind: "query",
        startedAt: progressStartedAt,
        finishedAt: progressFinishedAt,
        durationMs: progressFinishedAt - progressStartedAt,
        attempt
      })
    };
  }

  const compressedDraft = await dependencies.runners.reviseDraft.invokeWithTelemetry(
    buildLengthCompressionPrompt({
      originalDraft: state.currentDraft,
      jobUnderstanding,
      proposalPlan,
      selectedEvidence: state.selectedEvidence,
      softTargetChars: lengthBudget.softTargetChars,
      hardMaxChars: lengthBudget.hardMaxChars
    })
  );

  const traceEntries = ["enforce_length.compress"];
  let nextDraft = compressedDraft.output.trim() || state.currentDraft;
  let nextDraftHistory = nextDraft === state.currentDraft ? state.draftHistory : [...state.draftHistory, nextDraft];
  let nextTelemetry = appendStepTelemetry(state, {
    ...compressedDraft.telemetry,
    step: "enforce_length.compress",
    stage: "length_enforcement",
    attempt
  });

  if (nextDraft.length > lengthBudget.hardMaxChars) {
    const deterministicStartedAt = Date.now();
    const deterministicReduction = deterministicallyReduceCoverLetter(nextDraft, lengthBudget.hardMaxChars);
    const deterministicFinishedAt = Date.now();

    nextDraft = deterministicReduction.output;
    if (nextDraft !== nextDraftHistory[nextDraftHistory.length - 1]) {
      nextDraftHistory = [...nextDraftHistory, nextDraft];
    }
    traceEntries.push("enforce_length.reduce");
    nextTelemetry = [
      ...nextTelemetry,
      {
        step: `enforce_length.${deterministicReduction.strategy}`,
        stage: "length_enforcement",
        kind: "query",
        startedAt: deterministicStartedAt,
        finishedAt: deterministicFinishedAt,
        durationMs: deterministicFinishedAt - deterministicStartedAt,
        attempt
      }
    ];
  }

  const progressFinishedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "enforce_length",
    status: "completed",
    attempt,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

  return {
    ...state,
    currentDraft: nextDraft,
    draftHistory: nextDraftHistory,
    executionTrace: appendTraceEntries(state, traceEntries),
    stepTelemetry: nextTelemetry
  };
}

async function critiqueNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const { jobUnderstanding, retrievedContext, proposalPlan } = ensureProposalContext(state);
  const attempt = state.critiqueHistory.length + 1;
  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "critique",
    status: "started",
    attempt,
    startedAt: progressStartedAt
  });
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

  let latestCritique: DraftCritique = {
    ...critique.output,
    copyRisk: {
      ...deterministicCopyRisk,
      reasons: [...new Set([...deterministicCopyRisk.reasons, ...critique.output.copyRisk.reasons])]
    }
  };
  if (state.currentDraft.length > maxProposalCoverLetterChars) {
    latestCritique = {
      ...latestCritique,
      approvalStatus: "NEEDS_REVISION",
      issues: [...latestCritique.issues, `Cover letter exceeds ${maxProposalCoverLetterChars} characters.`],
      revisionInstructions: [
        ...latestCritique.revisionInstructions,
        `Reduce the cover letter to ${maxProposalCoverLetterChars} characters or fewer while preserving only the strongest grounded evidence.`
      ]
    };
  }

  const nextRevisionCount =
    latestCritique.approvalStatus === "NEEDS_REVISION" ? state.revisionCount + 1 : state.revisionCount;
  const shouldFinalize =
    latestCritique.approvalStatus === "APPROVED" || nextRevisionCount >= state.maxRevisions;
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "critique",
    status: "completed",
    attempt,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

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
      attempt
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

  const attempt = state.revisionCount;
  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "revise_if_needed",
    status: "started",
    attempt,
    startedAt: progressStartedAt
  });

  const selectedFragments = getSelectedFragments(retrievedContext, proposalPlan);
  const lengthBudget = getProposalLengthBudget(jobUnderstanding.proposalStrategy.length);

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
      })),
      softTargetChars: lengthBudget.softTargetChars,
      hardMaxChars: lengthBudget.hardMaxChars
    })
  );
  const progressFinishedAt = Date.now();

  await notifyProgress(dependencies, {
    step: "revise_if_needed",
    status: "completed",
    attempt,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

  return {
    ...state,
    currentDraft: revisedDraft.output,
    draftHistory: [...state.draftHistory, revisedDraft.output],
    executionTrace: appendTrace(state, "revise_if_needed"),
    stepTelemetry: appendStepTelemetry(state, {
      ...revisedDraft.telemetry,
      step: "revise_if_needed",
      stage: "revise_if_needed",
      attempt
    })
  };
}

function isLikelyLinkQuestion(prompt: string): boolean {
  return /github|portfolio|website|web site|url|link|profile/i.test(prompt);
}

function buildExactProfileAnswer(
  prompt: string,
  externalProfiles: ProposalEngineState["candidateProfile"]["externalProfiles"]
): string | null {
  const normalized = prompt.toLowerCase();
  const wantsGithub = normalized.includes("github");
  const wantsPortfolio = normalized.includes("portfolio");
  const wantsWebsite = normalized.includes("website") || normalized.includes("web site");
  const wantsProfile = normalized.includes("profile");
  const lines: string[] = [];

  if (wantsGithub && externalProfiles.githubUrl) {
    lines.push(`GitHub: ${externalProfiles.githubUrl}`);
  }
  if (wantsPortfolio && externalProfiles.portfolioUrl) {
    lines.push(`Portfolio: ${externalProfiles.portfolioUrl}`);
  }
  if (wantsWebsite && externalProfiles.websiteUrl) {
    lines.push(`Website: ${externalProfiles.websiteUrl}`);
  }

  if (lines.length === 0 && wantsProfile) {
    if (externalProfiles.githubUrl) {
      lines.push(`GitHub: ${externalProfiles.githubUrl}`);
    }
    if (externalProfiles.portfolioUrl) {
      lines.push(`Portfolio: ${externalProfiles.portfolioUrl}`);
    }
    if (externalProfiles.websiteUrl) {
      lines.push(`Website: ${externalProfiles.websiteUrl}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

async function answerQuestionsNode(
  state: ProposalEngineState,
  dependencies: ProposalEngineGraphDependencies
): Promise<ProposalEngineState> {
  const { retrievedContext } = ensureProposalContext(state);
  const questions = state.jobInput.proposalQuestions;
  if (questions.length === 0) {
    return state;
  }

  const progressStartedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "answer_questions",
    status: "started",
    attempt: 1,
    startedAt: progressStartedAt
  });

  const answeredByPosition = new Map<number, ProposalEngineState["questionAnswers"][number]>();
  const unresolvedByPosition = new Map<number, ProposalEngineState["unresolvedQuestions"][number]>();
  const llmQuestions: typeof questions = [];

  for (const question of questions) {
    const exactAnswer = buildExactProfileAnswer(question.prompt, state.candidateProfile.externalProfiles);
    if (exactAnswer) {
      answeredByPosition.set(question.position, {
        position: question.position,
        prompt: question.prompt,
        answer: exactAnswer
      });
      continue;
    }

    if (isLikelyLinkQuestion(question.prompt)) {
      unresolvedByPosition.set(question.position, {
        position: question.position,
        prompt: question.prompt,
        reason: "Matching external profile URL is not configured for this candidate."
      });
      continue;
    }

    llmQuestions.push(question);
  }

  let telemetry: GenerationStepTelemetry | null = null;
  if (llmQuestions.length > 0) {
    const answeredQuestions = await dependencies.runners.answerQuestions.invokeWithTelemetry(
      buildQuestionAnsweringPrompt({
        questions: llmQuestions,
        externalProfiles: state.candidateProfile.externalProfiles,
        selectedEvidence: state.selectedEvidence,
        retrievedEvidence: retrievedContext.evidenceCandidates.map((item) => ({
          id: item._id,
          text: item.text,
          type: item.type,
          tags: item.tags
        }))
      })
    );

    telemetry = {
      ...answeredQuestions.telemetry,
      step: "answer_questions",
      stage: "answer_questions",
      attempt: 1
    };

    for (const answer of answeredQuestions.output.answers) {
      answeredByPosition.set(answer.position, answer);
      unresolvedByPosition.delete(answer.position);
    }

    for (const unresolved of answeredQuestions.output.unresolved) {
      if (!answeredByPosition.has(unresolved.position)) {
        unresolvedByPosition.set(unresolved.position, unresolved);
      }
    }
  }

  for (const question of questions) {
    if (!answeredByPosition.has(question.position) && !unresolvedByPosition.has(question.position)) {
      unresolvedByPosition.set(question.position, {
        position: question.position,
        prompt: question.prompt,
        reason: "Could not produce a grounded answer from the available evidence."
      });
    }
  }

  const progressFinishedAt = Date.now();
  await notifyProgress(dependencies, {
    step: "answer_questions",
    status: "completed",
    attempt: 1,
    startedAt: progressStartedAt,
    finishedAt: progressFinishedAt,
    durationMs: progressFinishedAt - progressStartedAt
  });

  return {
    ...state,
    questionAnswers: Array.from(answeredByPosition.values()).sort((left, right) => left.position - right.position),
    unresolvedQuestions: Array.from(unresolvedByPosition.values()).sort(
      (left, right) => left.position - right.position
    ),
    executionTrace: appendTrace(state, "answer_questions"),
    stepTelemetry: telemetry ? appendStepTelemetry(state, telemetry) : state.stepTelemetry
  };
}

function routeAfterCritique(state: ProposalEngineState): "revise_if_needed" | "answer_questions" | typeof END {
  if (!state.latestCritique) {
    return END;
  }

  if (state.latestCritique.approvalStatus === "NEEDS_REVISION" && state.revisionCount < state.maxRevisions) {
    return "revise_if_needed";
  }

  return state.jobInput.proposalQuestions.length > 0 ? "answer_questions" : END;
}

export function createProposalEngineGraph(dependencies: ProposalEngineGraphDependencies) {
  return new StateGraph(ProposalEngineStateAnnotation)
    .addNode("job_understanding", (state: ProposalEngineState) => jobUnderstandingNode(state, dependencies))
    .addNode("retrieve_context", (state: ProposalEngineState) => retrieveContextNode(state, dependencies))
    .addNode("select_evidence", (state: ProposalEngineState) => selectEvidenceNode(state, dependencies))
    .addNode("plan_proposal", (state: ProposalEngineState) => planProposalNode(state, dependencies))
    .addNode("write_draft", (state: ProposalEngineState) => writeDraftNode(state, dependencies))
    .addNode("enforce_length", (state: ProposalEngineState) => enforceLengthNode(state, dependencies))
    .addNode("critique", (state: ProposalEngineState) => critiqueNode(state, dependencies))
    .addNode("revise_if_needed", (state: ProposalEngineState) => reviseIfNeededNode(state, dependencies))
    .addNode("answer_questions", (state: ProposalEngineState) => answerQuestionsNode(state, dependencies))
    .addEdge(START, "job_understanding")
    .addEdge("job_understanding", "retrieve_context")
    .addEdge("retrieve_context", "select_evidence")
    .addEdge("select_evidence", "plan_proposal")
    .addEdge("plan_proposal", "write_draft")
    .addEdge("write_draft", "enforce_length")
    .addEdge("enforce_length", "critique")
    .addConditionalEdges("critique", routeAfterCritique, ["revise_if_needed", "answer_questions", END])
    .addEdge("revise_if_needed", "enforce_length")
    .addEdge("answer_questions", END);
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
