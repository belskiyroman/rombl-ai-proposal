import { runCriticAgent, type LlmInvoker } from "../agents";
import { criticOutputSchema, type CriticOutput } from "../schemas";
import type { ProposalGraphState } from "../state";

export interface CriticNodeDependencies {
  critic?: LlmInvoker;
  critique?: (state: ProposalGraphState) => Promise<unknown>;
}

export async function criticNode(
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

export const runCriticNode = criticNode;
