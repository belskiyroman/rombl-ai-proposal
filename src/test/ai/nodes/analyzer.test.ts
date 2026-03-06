import { describe, expect, it, vi } from "vitest";

const getLLM = vi.hoisted(() => vi.fn());
const fastStructuredInvoke = vi.hoisted(() => vi.fn());
const fastWithStructuredOutput = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/ai/models", () => ({
  getLLM
}));

import { runAnalyzerNode } from "@/src/lib/ai/nodes";
import type { ProposalGraphState } from "@/src/lib/ai/state";

const sampleJobText =
  "I’m looking for an experienced full-stack developer or a small backend/frontend team to extend and enhance an existing SaaS product. Scope includes React + Next.js frontend, Node.js services, and multiple REST API integrations.";

const sampleProposalText =
  "Hello, I am Roman. I am a team lead/manager in my team. We are available for a new project. BTW, we can recommend a UI/UX designer! Our team consists of seniors who have 10+ years of experience. We are very good at React and Node.js.";

const baseState: ProposalGraphState = {
  newJobDescription: sampleJobText,
  ragContext: [
    {
      jobText: sampleJobText,
      proposalText: sampleProposalText,
      similarity: 0.99
    }
  ],
  styleProfile: null,
  proposalDraft: "",
  criticFeedback: null,
  revisionCount: 0,
  maxRevisions: 2,
  executionTrace: []
};

describe("runAnalyzerNode (ingestion focus)", () => {
  it("builds analyzer context from job + proposal text and normalizes structured style output", async () => {
    const invoke = vi.fn().mockResolvedValue({
      tech_stack: ["React", "Next.js", "Node.js", "REST API integrations", "react", " Node.js "],
      writing_style_analysis: {
        formality: 6,
        enthusiasm: 7,
        key_vocabulary: [
          "uses active verbs",
          "offers UI/UX designer",
          "mentions team seniority",
          "offers UI/UX designer"
        ],
        sentence_structure: "short, direct, action-first"
      },
      project_constraints: [
        "extend existing SaaS product",
        "ui/ux redesign in separate budget",
        "extend existing SaaS product"
      ]
    });

    const nextState = await runAnalyzerNode(baseState, {
      analyzer: { invoke }
    });

    const sentPrompt = invoke.mock.calls[0]?.[0] as string;
    expect(sentPrompt).toContain(sampleJobText);
    expect(sentPrompt).toContain(sampleProposalText);

    expect(nextState.styleProfile?.tech_stack).toEqual(["React", "Next.js", "Node.js", "REST API integrations"]);
    expect(nextState.styleProfile?.writing_style_analysis.key_vocabulary).toEqual([
      "uses active verbs",
      "offers UI/UX designer",
      "mentions team seniority"
    ]);
    expect(nextState.styleProfile?.project_constraints).toEqual([
      "extend existing SaaS product",
      "ui/ux redesign in separate budget"
    ]);
  });

  it("uses fast model fallback when explicit analyzer dependency is omitted", async () => {
    fastStructuredInvoke.mockResolvedValue({
      tech_stack: ["Convex", "TypeScript"],
      writing_style_analysis: {
        formality: 6,
        enthusiasm: 7,
        key_vocabulary: ["milestones"],
        sentence_structure: "direct"
      },
      project_constraints: ["fixed budget"]
    });
    fastWithStructuredOutput.mockReturnValue({
      invoke: fastStructuredInvoke
    });
    getLLM.mockReturnValue({
      withStructuredOutput: fastWithStructuredOutput
    });

    const nextState = await runAnalyzerNode(baseState, {});

    expect(getLLM).toHaveBeenCalledWith("fast");
    expect(fastWithStructuredOutput).toHaveBeenCalledOnce();
    expect(nextState.styleProfile?.tech_stack).toEqual(["Convex", "TypeScript"]);
  });
});
