import { analyzerOutputSchema, criticOutputSchema, type AnalyzerOutput, type CriticOutput } from "./schemas";
import type { ProposalGraphState } from "./state";
import { analyzerSystemPrompt, criticSystemPrompt, writerSystemPrompt } from "./prompts";
import { getLLM, type LLMFactoryOptions } from "./models";
import { ensureRuntimeGlobals } from "./runtime-polyfills";

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

export interface AgentRunnerModelOptions extends Pick<LLMFactoryOptions, "fastModel" | "reasoningModel"> {}

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
  const fewShotExamples =
    state.ragContext.length === 0
      ? "No retrieved examples."
      : state.ragContext
          .map(
            (pair, index) =>
              `Example ${index + 1}\nJob:\n${pair.jobText}\n\nWinning Proposal:\n${pair.proposalText}\n\nSimilarity:${
                pair.similarity ?? "n/a"
              }`
          )
          .join("\n\n---\n\n");

  const styleBlock = state.styleProfile
    ? `Formality: ${state.styleProfile.writing_style_analysis.formality}\nEnthusiasm: ${
        state.styleProfile.writing_style_analysis.enthusiasm
      }\nKey vocabulary: ${state.styleProfile.writing_style_analysis.key_vocabulary.join(
        ", "
      )}\nSentence structure: ${state.styleProfile.writing_style_analysis.sentence_structure}`
    : "Style profile unavailable.";

  const revisionBlock =
    state.criticFeedback?.status === "NEEDS_REVISION"
      ? `Revision Feedback:\n${(state.criticFeedback.critique_points || []).join("\n")}\n\n`
      : "";

  const authorIdentityBlock = state.authorName?.trim()
    ? `Author Identity Constraint:
Use "${state.authorName}" as the only personal name when self-identifying or signing off.
Do not introduce any other first name or full name.`
    : `Author Identity Constraint:
Do not invent a personal name.
If a sign-off is needed, use a neutral sign-off without a name.`;

  return `${writerSystemPrompt}

New Job Description:
${state.newJobDescription}

${authorIdentityBlock}

Style Profile:
${styleBlock}

Few-shot Examples:
${fewShotExamples}

${revisionBlock}Write only the final proposal in clean markdown.`;
}

export function buildCriticPrompt(state: ProposalGraphState): string {
  const authorIdentityBlock = state.authorName?.trim()
    ? `Author Identity Constraint:\nThe proposal must use "${state.authorName}" as the only personal name if a name is present.`
    : "Author Identity Constraint:\nNo personal name should be invented when unknown.";

  return `${criticSystemPrompt}\n\nJob Description:\n${state.newJobDescription}\n\nStyle Profile:\n${JSON.stringify(
    state.styleProfile,
    null,
    2
  )}\n\n${authorIdentityBlock}\n\nDraft Proposal:\n${state.proposalDraft}`;
}

export async function runAnalyzerAgent(state: ProposalGraphState, llm: LlmInvoker): Promise<AnalyzerOutput> {
  const raw = await llm.invoke(buildAnalyzerPrompt(state));
  return normalizeAnalyzerOutput(analyzerOutputSchema.parse(raw));
}

export async function runWriterAgent(state: ProposalGraphState, llm: WriterInvoker): Promise<string> {
  const proposal = await llm.invoke(buildWriterPrompt(state));
  return proposal.trim();
}

export async function runCriticAgent(state: ProposalGraphState, llm: LlmInvoker): Promise<CriticOutput> {
  const raw = await llm.invoke(buildCriticPrompt(state));
  return criticOutputSchema.parse(raw);
}

function normalizeStringList(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const cleaned = value.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      continue;
    }

    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(cleaned);
  }

  return normalized;
}

export function normalizeAnalyzerOutput(output: AnalyzerOutput): AnalyzerOutput {
  return {
    ...output,
    tech_stack: normalizeStringList(output.tech_stack),
    writing_style_analysis: {
      ...output.writing_style_analysis,
      key_vocabulary: normalizeStringList(output.writing_style_analysis.key_vocabulary),
      sentence_structure: output.writing_style_analysis.sentence_structure.trim().replace(/\s+/g, " ")
    },
    project_constraints: normalizeStringList(output.project_constraints)
  };
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

function normalizeRunnerModelOptions(
  modelOptions?: AgentRunnerModelOptions | string
): AgentRunnerModelOptions {
  if (!modelOptions) {
    return {};
  }

  if (typeof modelOptions === "string") {
    const trimmed = modelOptions.trim();
    if (!trimmed) {
      return {};
    }
    // Backward compatibility: single model override applies to both tiers.
    return {
      fastModel: trimmed,
      reasoningModel: trimmed
    };
  }

  return modelOptions;
}

export function createOpenAIAgentRunners(modelOptions?: AgentRunnerModelOptions | string): AgentRunners {
  ensureRuntimeGlobals();

  const normalizedModelOptions = normalizeRunnerModelOptions(modelOptions);
  const fastModel = getLLM("fast", normalizedModelOptions);
  const reasoningModel = getLLM("reasoning", normalizedModelOptions);

  const analyzerModel = fastModel.withStructuredOutput(analyzerOutputSchema, {
    name: "AnalyzerOutput"
  });
  const criticModel = fastModel.withStructuredOutput(criticOutputSchema, {
    name: "CriticOutput"
  });

  return {
    analyzer: {
      invoke: (prompt) => analyzerModel.invoke(prompt)
    },
    writer: {
      invoke: async (prompt) => {
        const message = await reasoningModel.invoke(prompt);
        return normalizeAiContent(message.content);
      }
    },
    critic: {
      invoke: (prompt) => criticModel.invoke(prompt)
    }
  };
}
