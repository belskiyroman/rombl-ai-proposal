import OpenAI from "openai";
import { getRequiredOpenAIApiKey } from "./openai-config";
import { normalizeTokenUsage, type StepTokenUsage } from "./telemetry";

export interface EmbeddingsClient {
  embeddings: {
    create: (params: { model: string; input: string }) => Promise<{
      data: Array<{ embedding: number[] }>;
      usage?: {
        prompt_tokens?: number;
        total_tokens?: number;
      };
    }>;
  };
}

export interface GenerateEmbeddingOptions {
  client?: EmbeddingsClient;
  model?: string;
}

export interface EmbeddingTelemetry {
  model: string;
  tokenUsage?: StepTokenUsage;
}

export interface GenerateEmbeddingResult {
  vector: number[];
  telemetry: EmbeddingTelemetry;
}

const defaultModel = "text-embedding-3-small";

export async function generateEmbeddingWithTelemetry(
  input: string,
  options: GenerateEmbeddingOptions = {}
): Promise<GenerateEmbeddingResult> {
  if (!input.trim()) {
    throw new Error("Input text cannot be empty.");
  }

  const client =
    options.client ??
    new OpenAI({
      apiKey: getRequiredOpenAIApiKey()
    });
  const model = options.model ?? defaultModel;

  const response = await client.embeddings.create({
    model,
    input
  });

  const firstVector = response.data[0]?.embedding;
  if (!firstVector) {
    throw new Error("OpenAI embeddings API returned an empty payload.");
  }

  return {
    vector: firstVector,
    telemetry: {
      model,
      tokenUsage: normalizeTokenUsage(response.usage) ?? undefined
    }
  };
}

export async function generateEmbedding(
  input: string,
  options: GenerateEmbeddingOptions = {}
): Promise<number[]> {
  const result = await generateEmbeddingWithTelemetry(input, options);
  return result.vector;
}
