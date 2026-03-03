import { describe, expect, it, vi } from "vitest";

import { generateEmbedding } from "@/src/lib/ai/embeddings";

describe("generateEmbedding", () => {
  it("returns an embedding vector from the OpenAI embeddings API", async () => {
    const create = vi.fn().mockResolvedValue({
      data: [{ embedding: [0.11, 0.22, 0.33] }]
    });

    const client = {
      embeddings: { create }
    };

    const vector = await generateEmbedding("Build a Next.js app", {
      client,
      model: "text-embedding-3-small"
    });

    expect(create).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "Build a Next.js app"
    });
    expect(vector).toEqual([0.11, 0.22, 0.33]);
  });
});
