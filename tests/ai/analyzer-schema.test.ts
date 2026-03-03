import { describe, expect, it } from "vitest";

import { analyzerOutputSchema } from "@/src/lib/ai/schemas";

describe("analyzerOutputSchema", () => {
  it("rejects invalid style profile values", () => {
    const result = analyzerOutputSchema.safeParse({
      tech_stack: ["TypeScript", "Convex"],
      writing_style_analysis: {
        formality: 11,
        enthusiasm: 0,
        key_vocabulary: ["ROI"],
        sentence_structure: "short and direct"
      },
      project_constraints: ["budget-sensitive"]
    });

    expect(result.success).toBe(false);
  });
});
