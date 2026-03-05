import { describe, expect, it, vi } from "vitest";

import { runProposalGraph } from "@/src/lib/ai/graph";
import { createInitialState } from "@/src/lib/ai/state";

describe("runProposalGraph loop", () => {
  it("revises once and then exits when critic approves", async () => {
    const writerInvoke = vi
      .fn()
      .mockResolvedValueOnce("## Draft V1\nNeeds refinement.")
      .mockResolvedValueOnce("## Draft V2\nFinal proposal.");
    const criticInvoke = vi
      .fn()
      .mockResolvedValueOnce({
        status: "NEEDS_REVISION",
        critique_points: ["Clarify project milestones"]
      })
      .mockResolvedValueOnce({
        status: "APPROVED",
        critique_points: null
      });

    const initialState = {
      ...createInitialState("Need proposal for AI SaaS extension"),
      ragContext: [
        {
          jobText: "Extend SaaS with AI features",
          proposalText: "We can deliver in phases.",
          similarity: 0.91
        }
      ],
      styleProfile: {
        tech_stack: ["React", "Node.js"],
        writing_style_analysis: {
          formality: 7,
          enthusiasm: 6,
          key_vocabulary: ["ROI", "milestones"],
          sentence_structure: "direct"
        },
        project_constraints: ["fixed budget"]
      },
      maxRevisions: 2
    };

    const finalState = await runProposalGraph(initialState, {
      writer: {
        writer: {
          invoke: writerInvoke
        }
      },
      critic: {
        critic: {
          invoke: criticInvoke
        }
      }
    });

    expect(writerInvoke).toHaveBeenCalledTimes(2);
    expect(criticInvoke).toHaveBeenCalledTimes(2);
    expect(finalState.proposalDraft).toBe("## Draft V2\nFinal proposal.");
    expect(finalState.criticFeedback?.status).toBe("APPROVED");
    expect(finalState.executionTrace).toEqual(["writer", "critic", "writer", "critic"]);
  });
});
