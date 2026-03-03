import { describe, expect, it, vi } from "vitest";

import { runGenerateProposal } from "@/convex/generate";

describe("runGenerateProposal", () => {
  it("executes embedding -> rag -> graph in order and preserves revision loop trace", async () => {
    const callOrder: string[] = [];

    const embed = vi.fn(async () => {
      callOrder.push("embedding");
      return [0.12, 0.34, 0.56];
    });

    const searchRag = vi.fn(async () => {
      callOrder.push("rag");
      return [
        {
          jobText: "Build AI proposal system",
          proposalText: "I can deliver this quickly.",
          similarity: 0.93
        }
      ];
    });

    const runGraph = vi.fn(async (initialState) => {
      callOrder.push("graph");
      expect(initialState.ragContext).toHaveLength(1);

      return {
        ...initialState,
        styleProfile: {
          tech_stack: ["TypeScript", "LangGraph"],
          writing_style_analysis: {
            formality: 7,
            enthusiasm: 6,
            key_vocabulary: ["ROI", "timeline"],
            sentence_structure: "concise"
          },
          project_constraints: ["tight budget"]
        },
        proposalDraft: "Final proposal body",
        criticFeedback: {
          status: "APPROVED"
        },
        revisionCount: 1,
        executionTrace: ["analyzer", "writer", "critic", "writer", "critic"]
      };
    });

    const result = await runGenerateProposal(
      {
        newJobDescription: "Need a TypeScript AI architect",
        maxRevisions: 2
      },
      {
        embed,
        searchRag,
        runGraph
      }
    );

    expect(callOrder).toEqual(["embedding", "rag", "graph"]);
    expect(result.finalProposal).toBe("Final proposal body");
    expect(result.executionTrace).toEqual(["analyzer", "writer", "critic", "writer", "critic"]);
    expect(result.criticStatus).toBe("APPROVED");
  });
});
