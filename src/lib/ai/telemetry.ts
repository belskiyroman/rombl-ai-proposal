export type StepTelemetryKind = "llm" | "embedding" | "vector_search" | "query";

export interface StepTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
}

export interface GenerationStepTelemetry {
  step: string;
  stage: string;
  kind: StepTelemetryKind;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  model?: string;
  attempt?: number;
  limit?: number;
  resultCount?: number;
  fragmentType?: string;
  tokenUsage?: StepTokenUsage;
}

export interface GenerationTelemetrySummary {
  totalSteps: number;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalReasoningTokens: number;
}

type UnknownRecord = Record<string, unknown>;

function readNumber(source: UnknownRecord, keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function normalizeTokenUsageRecord(value: UnknownRecord): StepTokenUsage | null {
  const outputDetails = asRecord(value.output_token_details) ?? asRecord(value.outputTokenDetails);
  const inputTokens = readNumber(value, ["input_tokens", "prompt_tokens", "promptTokens", "inputTokens"]);
  const outputTokens = readNumber(value, ["output_tokens", "completion_tokens", "completionTokens", "outputTokens"]);
  const totalTokens = readNumber(value, ["total_tokens", "totalTokens"]) || inputTokens + outputTokens;
  const reasoningTokens =
    readNumber(value, ["reasoning_tokens", "reasoningTokens"]) +
    (outputDetails ? readNumber(outputDetails, ["reasoning_tokens", "reasoningTokens", "reasoning"]) : 0);

  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0 && reasoningTokens === 0) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens
  };
}

export function normalizeTokenUsage(value: unknown): StepTokenUsage | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return normalizeTokenUsageRecord(record);
}

export function extractMessageTokenUsage(message: unknown): StepTokenUsage | null {
  const record = asRecord(message);
  if (!record) {
    return null;
  }

  const usageMetadata = normalizeTokenUsage(record.usage_metadata);
  if (usageMetadata) {
    return usageMetadata;
  }

  const responseMetadata = asRecord(record.response_metadata);
  if (!responseMetadata) {
    return null;
  }

  return normalizeTokenUsage(responseMetadata.tokenUsage) ?? normalizeTokenUsage(responseMetadata.usage);
}

export function summarizeTelemetry(steps: GenerationStepTelemetry[]): GenerationTelemetrySummary {
  return steps.reduce<GenerationTelemetrySummary>(
    (summary, step) => {
      return {
        totalSteps: summary.totalSteps + 1,
        totalDurationMs: summary.totalDurationMs + step.durationMs,
        totalInputTokens: summary.totalInputTokens + (step.tokenUsage?.inputTokens ?? 0),
        totalOutputTokens: summary.totalOutputTokens + (step.tokenUsage?.outputTokens ?? 0),
        totalTokens: summary.totalTokens + (step.tokenUsage?.totalTokens ?? 0),
        totalReasoningTokens: summary.totalReasoningTokens + (step.tokenUsage?.reasoningTokens ?? 0)
      };
    },
    {
      totalSteps: 0,
      totalDurationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalReasoningTokens: 0
    }
  );
}
