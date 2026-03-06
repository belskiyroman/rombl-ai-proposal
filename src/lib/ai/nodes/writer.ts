import { runWriterAgent, type WriterInvoker } from "../agents";
import { getLLM } from "../models";
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
    const model = getLLM("reasoning");
    proposalDraft = await runWriterAgent(state, {
      invoke: async (prompt) => {
        const message = await model.invoke(prompt);
        return normalizeAiContent(message.content);
      }
    });
  }

  return {
    ...state,
    proposalDraft,
    executionTrace: [...state.executionTrace, "writer"]
  };
}

export const runWriterNode = writerNode;

function normalizeAiContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (typeof part === "object" && part !== null && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}
