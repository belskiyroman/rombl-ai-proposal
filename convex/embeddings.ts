import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import { generateEmbedding } from "../src/lib/ai/embeddings";
import { normalizeJobDescription } from "../src/lib/ai/job-description-normalizer";

export const generateJobEmbedding = actionGeneric({
  args: {
    input: v.string(),
    model: v.optional(v.string())
  },
  handler: async (_ctx, args) => {
    const normalizedInput = normalizeJobDescription(args.input);
    if (normalizedInput.metadata.wasTruncated) {
      console.warn(
        `[embeddings.generateJobEmbedding] Truncated job description from ${normalizedInput.metadata.originalLength} to ${normalizedInput.metadata.finalLength} chars.`
      );
    }

    const embedding = await generateEmbedding(normalizedInput.text, {
      model: args.model
    });

    return { embedding };
  }
});
