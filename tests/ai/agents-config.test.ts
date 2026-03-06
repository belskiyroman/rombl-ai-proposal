import { beforeEach, describe, expect, it, vi } from "vitest";

import { createOpenAIAgentRunners } from "@/src/lib/ai/agents";
import { analyzerOutputSchema, criticOutputSchema } from "@/src/lib/ai/schemas";

const getLLM = vi.hoisted(() => vi.fn());
const fastStructuredInvoke = vi.hoisted(() => vi.fn());
const criticStructuredInvoke = vi.hoisted(() => vi.fn());
const reasoningInvoke = vi.hoisted(() => vi.fn());
const fastWithStructuredOutput = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/ai/models", () => ({
  getLLM
}));

describe("createOpenAIAgentRunners", () => {
  beforeEach(() => {
    getLLM.mockReset();
    fastStructuredInvoke.mockReset();
    criticStructuredInvoke.mockReset();
    reasoningInvoke.mockReset();
    fastWithStructuredOutput.mockReset();
  });

  it("uses fast model for analyzer/critic and reasoning model for writer", async () => {
    fastStructuredInvoke.mockResolvedValue({
      tech_stack: ["React"],
      writing_style_analysis: {
        formality: 7,
        enthusiasm: 6,
        key_vocabulary: ["ROI"],
        sentence_structure: "concise"
      },
      project_constraints: ["budget"]
    });
    criticStructuredInvoke.mockResolvedValue({
      status: "NEEDS_REVISION",
      critique_points: ["Clarify milestones"]
    });
    reasoningInvoke.mockResolvedValue({
      content: "Reasoning draft output"
    });

    fastWithStructuredOutput.mockImplementation((schema: unknown) => {
      if (schema === analyzerOutputSchema) {
        return { invoke: fastStructuredInvoke };
      }
      return { invoke: criticStructuredInvoke };
    });

    getLLM.mockImplementation((tier: string) => {
      if (tier === "fast") {
        return { withStructuredOutput: fastWithStructuredOutput };
      }
      return { invoke: reasoningInvoke };
    });

    const runners = createOpenAIAgentRunners();
    const analyzerResult = await runners.analyzer.invoke("analyze");
    const criticResult = await runners.critic.invoke("critic");
    const writerResult = await runners.writer.invoke("writer");

    expect(getLLM).toHaveBeenNthCalledWith(1, "fast", {});
    expect(getLLM).toHaveBeenNthCalledWith(2, "reasoning", {});
    expect(fastWithStructuredOutput).toHaveBeenNthCalledWith(1, analyzerOutputSchema, {
      name: "AnalyzerOutput"
    });
    expect(fastWithStructuredOutput).toHaveBeenNthCalledWith(2, criticOutputSchema, {
      name: "CriticOutput"
    });
    expect(analyzerResult).toMatchObject({ tech_stack: ["React"] });
    expect(criticResult).toMatchObject({ status: "NEEDS_REVISION" });
    expect(writerResult).toBe("Reasoning draft output");
  });

  it("passes explicit fast/reasoning model overrides to the factory", () => {
    fastWithStructuredOutput.mockReturnValue({ invoke: fastStructuredInvoke });
    getLLM.mockImplementation((tier: string) => {
      if (tier === "fast") {
        return { withStructuredOutput: fastWithStructuredOutput };
      }
      return { invoke: reasoningInvoke };
    });

    createOpenAIAgentRunners({
      fastModel: "gpt-5-mini-override",
      reasoningModel: "gpt-5.4-override"
    });

    expect(getLLM).toHaveBeenNthCalledWith(1, "fast", {
      fastModel: "gpt-5-mini-override",
      reasoningModel: "gpt-5.4-override"
    });
    expect(getLLM).toHaveBeenNthCalledWith(2, "reasoning", {
      fastModel: "gpt-5-mini-override",
      reasoningModel: "gpt-5.4-override"
    });
  });
});
