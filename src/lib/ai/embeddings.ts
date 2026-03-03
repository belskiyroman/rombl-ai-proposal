import OpenAI from "openai";

export interface EmbeddingsClient {
  embeddings: {
    create: (params: { model: string; input: string }) => Promise<{
      data: Array<{ embedding: number[] }>;
    }>;
  };
}

export interface GenerateEmbeddingOptions {
  client?: EmbeddingsClient;
  model?: string;
}

const defaultModel = "text-embedding-3-small";

export async function generateEmbedding(
  input: string,
  options: GenerateEmbeddingOptions = {}
): Promise<number[]> {
  if (!input.trim()) {
    throw new Error("Input text cannot be empty.");
  }

  const client =
    options.client ??
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
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

  return firstVector;
}
