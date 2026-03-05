import { describe, expect, it, vi } from "vitest";

import { criticNode } from "@/src/lib/ai/nodes/critic";
import { writerNode } from "@/src/lib/ai/nodes/writer";
import type { ProposalGraphState } from "@/src/lib/ai/state";

const baseState: ProposalGraphState = {
  newJobDescription: "Need an AI proposal generator for freelance jobs",
  authorName: "Roman Belskiy",
  ragContext: [
    {
      jobText: "Build SaaS proposal automation",
      proposalText: "I lead a senior team and can ship this quickly.",
      similarity: 0.95
    }
  ],
  styleProfile: {
    tech_stack: ["TypeScript", "Node.js", "Convex"],
    writing_style_analysis: {
      formality: 7,
      enthusiasm: 6,
      key_vocabulary: ["ROI", "timeline", "senior team"],
      sentence_structure: "concise and direct"
    },
    project_constraints: ["2-week launch"]
  },
  proposalDraft: "",
  criticFeedback: null,
  revisionCount: 0,
  maxRevisions: 2,
  executionTrace: []
};

describe("writerNode", () => {
  it("builds a few-shot prompt from job, ragContext, and styleProfile, returning markdown draft", async () => {
    const invoke = vi.fn().mockResolvedValue("## Proposal\n\nI can deliver this in milestones.");
    const nextState = await writerNode(baseState, {
      writer: { invoke }
    });

    expect(invoke).toHaveBeenCalledOnce();
    const prompt = invoke.mock.calls[0]?.[0] as string;
    expect(prompt).toContain(baseState.newJobDescription);
    expect(prompt).toContain(baseState.ragContext[0].jobText);
    expect(prompt).toContain(baseState.ragContext[0].proposalText);
    expect(prompt).toContain("ROI");
    expect(prompt).toContain("Author Identity Constraint");
    expect(prompt).toContain("Roman Belskiy");
    expect(nextState.proposalDraft).toBe("## Proposal\n\nI can deliver this in milestones.");
    expect(nextState.executionTrace).toEqual(["writer"]);
  });
});

describe("criticNode", () => {
  it("returns schema-validated critique feedback", async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: "NEEDS_REVISION",
      critique_points: ["Address client budget explicitly"]
    });

    const nextState = await criticNode(
      {
        ...baseState,
        proposalDraft: "## Proposal\n\nDraft body"
      },
      {
        critic: { invoke }
      }
    );

    expect(nextState.criticFeedback).toEqual({
      status: "NEEDS_REVISION",
      critique_points: ["Address client budget explicitly"]
    });
    expect(nextState.revisionCount).toBe(1);
    expect(nextState.executionTrace).toEqual(["critic"]);
  });

  it("throws when critic output does not match schema", async () => {
    await expect(
      criticNode(
        {
          ...baseState,
          proposalDraft: "## Proposal\n\nDraft body"
        },
        {
          critic: { invoke: vi.fn().mockResolvedValue({ status: "NEEDS_REVISION" }) }
        }
      )
    ).rejects.toThrow();
  });
});
