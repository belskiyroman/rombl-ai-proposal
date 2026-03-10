import { describe, expect, it } from "vitest";

import { extractMessageTokenUsage, normalizeTokenUsage, summarizeTelemetry } from "@/src/lib/ai/telemetry";

describe("normalizeTokenUsage", () => {
  it("normalizes OpenAI response usage shapes", () => {
    expect(
      normalizeTokenUsage({
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
        output_token_details: {
          reasoning_tokens: 12
        }
      })
    ).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
      reasoningTokens: 12
    });
  });
});

describe("extractMessageTokenUsage", () => {
  it("prefers usage_metadata when present", () => {
    expect(
      extractMessageTokenUsage({
        usage_metadata: {
          input_tokens: 80,
          output_tokens: 20,
          total_tokens: 100
        },
        response_metadata: {
          tokenUsage: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2
          }
        }
      })
    ).toEqual({
      inputTokens: 80,
      outputTokens: 20,
      totalTokens: 100,
      reasoningTokens: 0
    });
  });
});

describe("summarizeTelemetry", () => {
  it("aggregates step duration and tokens", () => {
    const summary = summarizeTelemetry([
      {
        step: "job_understanding",
        stage: "job_understanding",
        kind: "llm",
        startedAt: 100,
        finishedAt: 300,
        durationMs: 200,
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          reasoningTokens: 0
        }
      },
      {
        step: "write_draft",
        stage: "write_draft",
        kind: "llm",
        startedAt: 400,
        finishedAt: 900,
        durationMs: 500,
        tokenUsage: {
          inputTokens: 200,
          outputTokens: 80,
          totalTokens: 280,
          reasoningTokens: 30
        }
      }
    ]);

    expect(summary).toEqual({
      totalSteps: 2,
      totalDurationMs: 700,
      totalInputTokens: 300,
      totalOutputTokens: 100,
      totalTokens: 400,
      totalReasoningTokens: 30
    });
  });
});
