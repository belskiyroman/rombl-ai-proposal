import {
  normalizeAnalyzerOutput,
  runAnalyzerAgent,
  type LlmInvoker
} from "../agents";
import { analyzerOutputSchema, type AnalyzerOutput } from "../schemas";
import type { ProposalGraphState } from "../state";

export interface AnalyzerNodeDependencies {
  analyzer?: LlmInvoker;
  analyze?: (jobDescription: string) => Promise<unknown>;
}

export async function analyzerNode(
  state: ProposalGraphState,
  dependencies: AnalyzerNodeDependencies
): Promise<ProposalGraphState> {
  let styleProfile: AnalyzerOutput;
  if (dependencies.analyzer) {
    styleProfile = await runAnalyzerAgent(state, dependencies.analyzer);
  } else if (dependencies.analyze) {
    const rawOutput = await dependencies.analyze(state.newJobDescription);
    styleProfile = normalizeAnalyzerOutput(analyzerOutputSchema.parse(rawOutput));
  } else {
    throw new Error("Analyzer node dependencies were not provided.");
  }

  return {
    ...state,
    styleProfile,
    executionTrace: [...state.executionTrace, "analyzer"]
  };
}

export const runAnalyzerNode = analyzerNode;
