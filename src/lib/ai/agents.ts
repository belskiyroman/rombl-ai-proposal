import { ChatOpenAI } from "@langchain/openai";

import { analyzerOutputSchema, criticOutputSchema, type AnalyzerOutput, type CriticOutput } from "./schemas";
import type { ProposalGraphState } from "./state";
import { analyzerSystemPrompt, criticSystemPrompt, writerSystemPrompt } from "./prompts";

export interface LlmInvoker {
  invoke: (prompt: string) => Promise<unknown>;
}

export interface WriterInvoker {
  invoke: (prompt: string) => Promise<string>;
}

export interface AgentRunners {
  analyzer: LlmInvoker;
  writer: WriterInvoker;
  critic: LlmInvoker;
}

export function buildAnalyzerPrompt(state: ProposalGraphState): string {
  const ragExamples = state.ragContext
    .map(
      (pair, index) =>
        `Example ${index + 1}\nJob:\n${pair.jobText}\nProposal:\n${pair.proposalText}\nSimilarity:${pair.similarity ?? "n/a"}`
    )
    .join("\n\n");

  return `${analyzerSystemPrompt}\n\nJob Description:\n${state.newJobDescription}\n\nRetrieved Examples:\n${ragExamples || "None"}`;
}

export function buildWriterPrompt(state: ProposalGraphState): string {
  return `${writerSystemPrompt}\n\nNew Job Description:\n${state.newJobDescription}\n\nStyle Profile:\n${JSON.stringify(
    state.styleProfile,
    null,
    2
  )}\n\nRetrieved Similar Proposals:\n${JSON.stringify(state.ragContext, null, 2)}\n\n${
    state.criticFeedback?.status === "NEEDS_REVISION"
      ? `Revision feedback:\n${(state.criticFeedback.critique_points || []).join("\n")}\n\n`
      : ""
  }Write only the final proposal text.`;
}

export function buildCriticPrompt(state: ProposalGraphState): string {
  return `${criticSystemPrompt}\n\nJob Description:\n${state.newJobDescription}\n\nStyle Profile:\n${JSON.stringify(
    state.styleProfile,
    null,
    2
  )}\n\nDraft Proposal:\n${state.proposalDraft}`;
}

export async function runAnalyzerAgent(state: ProposalGraphState, llm: LlmInvoker): Promise<AnalyzerOutput> {
  const raw = await llm.invoke(buildAnalyzerPrompt(state));
  return analyzerOutputSchema.parse(raw);
}

export async function runWriterAgent(state: ProposalGraphState, llm: WriterInvoker): Promise<string> {
  const proposal = await llm.invoke(buildWriterPrompt(state));
  return proposal.trim();
}

export async function runCriticAgent(state: ProposalGraphState, llm: LlmInvoker): Promise<CriticOutput> {
  const raw = await llm.invoke(buildCriticPrompt(state));
  return criticOutputSchema.parse(raw);
}

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

export function resolveOpenAIModel(modelName?: string): string {
  if (modelName?.trim()) {
    return modelName.trim();
  }

  if (process.env.OPENAI_MODEL?.trim()) {
    return process.env.OPENAI_MODEL.trim();
  }

  return "gpt-4o-mini";
}

export function createOpenAIAgentRunners(modelName?: string): AgentRunners {
  const resolvedModelName = resolveOpenAIModel(modelName);
  const chatModel = new ChatOpenAI({
    model: resolvedModelName,
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY
  });

  const analyzerModel = chatModel.withStructuredOutput(analyzerOutputSchema, {
    name: "AnalyzerOutput"
  });
  const criticModel = chatModel.withStructuredOutput(criticOutputSchema, {
    name: "CriticOutput"
  });

  return {
    analyzer: {
      invoke: (prompt) => analyzerModel.invoke(prompt)
    },
    writer: {
      invoke: async (prompt) => {
        const message = await chatModel.invoke(prompt);
        return normalizeAiContent(message.content);
      }
    },
    critic: {
      invoke: (prompt) => criticModel.invoke(prompt)
    }
  };
}
