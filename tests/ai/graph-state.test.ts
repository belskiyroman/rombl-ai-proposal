import { describe, expect, it, vi } from "vitest";

import { runAnalyzerNode } from "@/src/lib/ai/nodes";
import type { ProposalGraphState } from "@/src/lib/ai/state";

describe("ProposalGraphState and analyzer node", () => {
  it("updates style profile from analyzer output", async () => {
    const state: ProposalGraphState = {
      newJobDescription: "Need a React + Convex marketplace MVP",
      ragContext: [],
      styleProfile: null,
      proposalDraft: "",
      criticFeedback: null,
      revisionCount: 0,
      maxRevisions: 2,
      executionTrace: []
    };

    const analyzer = vi.fn().mockResolvedValue({
      tech_stack: ["React", "Convex"],
      writing_style_analysis: {
        formality: 6,
        enthusiasm: 7,
        key_vocabulary: ["ROI", "delivery"],
        sentence_structure: "short, direct"
      },
      project_constraints: ["tight deadline"]
    });

    const nextState = await runAnalyzerNode(state, { analyze: analyzer });

    expect(analyzer).toHaveBeenCalledWith(state.newJobDescription);
    expect(nextState.styleProfile?.writing_style_analysis.formality).toBe(6);
    expect(nextState.styleProfile?.tech_stack).toEqual(["React", "Convex"]);
  });
});
