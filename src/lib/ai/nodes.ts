import { runAnalyzerAgent, runCriticAgent, runWriterAgent, type LlmInvoker, type WriterInvoker } from "./agents";
import { analyzerOutputSchema, criticOutputSchema, type AnalyzerOutput, type CriticOutput } from "./schemas";
import type { ProposalGraphState } from "./state";

export interface AnalyzerNodeDependencies {
  analyzer?: LlmInvoker;
  analyze?: (jobDescription: string) => Promise<unknown>;
}

export interface WriterNodeDependencies {
  writer?: WriterInvoker;
  write?: (state: ProposalGraphState) => Promise<string>;
}

export interface CriticNodeDependencies {
  critic?: LlmInvoker;
  critique?: (state: ProposalGraphState) => Promise<unknown>;
}

export async function runAnalyzerNode(
  state: ProposalGraphState,
  dependencies: AnalyzerNodeDependencies
): Promise<ProposalGraphState> {
  let styleProfile: AnalyzerOutput;
  if (dependencies.analyzer) {
    styleProfile = await runAnalyzerAgent(state, dependencies.analyzer);
  } else if (dependencies.analyze) {
    const rawOutput = await dependencies.analyze(state.newJobDescription);
    styleProfile = analyzerOutputSchema.parse(rawOutput);
  } else {
    throw new Error("Analyzer node dependencies were not provided.");
  }

  return {
    ...state,
    styleProfile,
    executionTrace: [...state.executionTrace, "analyzer"]
  };
}

export async function runWriterNode(
  state: ProposalGraphState,
  dependencies: WriterNodeDependencies
): Promise<ProposalGraphState> {
  let proposalDraft: string;
  if (dependencies.writer) {
    proposalDraft = await runWriterAgent(state, dependencies.writer);
  } else if (dependencies.write) {
    proposalDraft = await dependencies.write(state);
  } else {
    throw new Error("Writer node dependencies were not provided.");
  }

  return {
    ...state,
    proposalDraft,
    executionTrace: [...state.executionTrace, "writer"]
  };
}

export async function runCriticNode(
  state: ProposalGraphState,
  dependencies: CriticNodeDependencies
): Promise<ProposalGraphState> {
  let criticFeedback: CriticOutput;
  if (dependencies.critic) {
    criticFeedback = await runCriticAgent(state, dependencies.critic);
  } else if (dependencies.critique) {
    const rawOutput = await dependencies.critique(state);
    criticFeedback = criticOutputSchema.parse(rawOutput);
  } else {
    throw new Error("Critic node dependencies were not provided.");
  }

  return {
    ...state,
    criticFeedback,
    revisionCount:
      criticFeedback.status === "NEEDS_REVISION" ? state.revisionCount + 1 : state.revisionCount,
    executionTrace: [...state.executionTrace, "critic"]
  };
}
