import { describe, expect, it, vi } from "vitest";

import { runAnalyzerAgent, runCriticAgent } from "@/src/lib/ai/agents";
import type { ProposalGraphState } from "@/src/lib/ai/state";

const baseState: ProposalGraphState = {
  newJobDescription: "Need a Next.js + Convex engineer to ship an MVP",
  ragContext: [
    {
      jobText: "Build SaaS dashboard",
      proposalText: "I deliver revenue-focused MVPs with clear milestones.",
      similarity: 0.91
    }
  ],
  styleProfile: null,
  proposalDraft: "",
  criticFeedback: null,
  revisionCount: 0,
  maxRevisions: 2,
  executionTrace: []
};

describe("agent nodes", () => {
  it("returns structured analyzer output from mocked LLM response", async () => {
    const invoke = vi.fn().mockResolvedValue({
      tech_stack: ["Next.js", "Convex"],
      writing_style_analysis: {
        formality: 7,
        enthusiasm: 6,
        key_vocabulary: ["MVP", "ROI"],
        sentence_structure: "concise and direct"
      },
      project_constraints: ["2-week timeline"]
    });

    const result = await runAnalyzerAgent(baseState, {
      invoke
    });

    expect(invoke).toHaveBeenCalledOnce();
    expect(result.writing_style_analysis.formality).toBe(7);
    expect(result.tech_stack).toEqual(["Next.js", "Convex"]);
  });

  it("returns structured critic output from mocked LLM response", async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: "NEEDS_REVISION",
      critique_points: ["Address budget concerns explicitly"]
    });

    const result = await runCriticAgent(
      {
        ...baseState,
        styleProfile: {
          tech_stack: ["Next.js"],
          writing_style_analysis: {
            formality: 6,
            enthusiasm: 7,
            key_vocabulary: ["timeline"],
            sentence_structure: "short"
          },
          project_constraints: ["fixed budget"]
        },
        proposalDraft: "I can do this quickly."
      },
      {
        invoke
      }
    );

    expect(invoke).toHaveBeenCalledOnce();
    expect(result.status).toBe("NEEDS_REVISION");
    expect(result.critique_points).toEqual(["Address budget concerns explicitly"]);
  });
});
