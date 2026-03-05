import { runWriterAgent, type WriterInvoker } from "../agents";
import type { ProposalGraphState } from "../state";

export interface WriterNodeDependencies {
  writer?: WriterInvoker;
  write?: (state: ProposalGraphState) => Promise<string>;
}

export async function writerNode(
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

export const runWriterNode = writerNode;
