import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import { generateEmbedding } from "../src/lib/ai/embeddings";

export const generateJobEmbedding = actionGeneric({
  args: {
    input: v.string(),
    model: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    const embedding = await generateEmbedding(args.input, {
      model: args.model
    });

    return { embedding };
  }
});
