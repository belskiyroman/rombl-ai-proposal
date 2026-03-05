import { describe, expect, it, vi } from "vitest";

import { runCreateProposal, runRetrieveRagContext } from "@/convex/generate";

describe("runRetrieveRagContext", () => {
  it("embeds input, runs vector search, and returns top 3 joined rag pairs", async () => {
    const embed = vi.fn().mockResolvedValue([0.12, 0.34, 0.56]);
    const vectorSearch = vi.fn().mockResolvedValue([
      { _id: "raw_2", _score: 0.96 },
      { _id: "raw_4", _score: 0.93 },
      { _id: "raw_1", _score: 0.9 },
      { _id: "raw_3", _score: 0.87 }
    ]);

    const getRawJob = vi.fn(async (id: string) => ({
      _id: id,
      text: `Job text for ${id}`,
      title: `Title ${id}`,
      techStack: ["React", "Node.js"]
    }));
    const getProposalByRawJobId = vi.fn(async (id: string) => ({
      _id: `proposal-${id}`,
      text: `Proposal text for ${id}`,
      styleProfileId: `style-${id}`
    }));
    const getStyleProfileById = vi.fn(async (id: string) => ({
      _id: id,
      writingStyleAnalysis: {
        formality: 6,
        enthusiasm: 7,
        keyVocabulary: ["ROI", "timeline"],
        sentenceStructure: "direct"
      }
    }));

    const ragContext = await runRetrieveRagContext(
      {
        newJobDescription: "Need a TypeScript AI architect",
        limit: 3
      },
      {
        embed,
        vectorSearch,
        getRawJob,
        getProposalByRawJobId,
        getStyleProfileById
      }
    );

    expect(embed).toHaveBeenCalledWith("Need a TypeScript AI architect");
    expect(vectorSearch).toHaveBeenCalledWith([0.12, 0.34, 0.56], 3);
    expect(ragContext).toHaveLength(3);
    expect(ragContext[0]).toMatchObject({
      jobText: "Job text for raw_2",
      proposalText: "Proposal text for raw_2",
      similarity: 0.96
    });
    expect(ragContext[2].jobText).toBe("Job text for raw_1");
  });
});

describe("runCreateProposal", () => {
  it("orchestrates retrieval + style profile lookup + graph run and returns approved proposal", async () => {
    const callOrder: string[] = [];

    const retrieveRagContext = vi.fn(async () => {
      callOrder.push("retrieval");
      return [
        {
          jobText: "Build AI proposal system",
          proposalText: "I can deliver this quickly.",
          similarity: 0.93
        }
      ];
    });

    const getGlobalStyleProfile = vi.fn(async () => {
      callOrder.push("style");
      return {
        tech_stack: ["TypeScript", "LangGraph"],
        writing_style_analysis: {
          formality: 7,
          enthusiasm: 6,
          key_vocabulary: ["ROI", "timeline"],
          sentence_structure: "concise"
        },
        project_constraints: ["tight budget"]
      };
    });

    const runGraph = vi.fn(async (initialState) => {
      callOrder.push("graph");
      expect(initialState.ragContext).toHaveLength(1);
      expect(initialState.styleProfile?.tech_stack).toEqual(["TypeScript", "LangGraph"]);

        return {
          ...initialState,
          proposalDraft: "Final proposal body",
          criticFeedback: {
          status: "APPROVED",
          critique_points: null
          },
          revisionCount: 1,
          executionTrace: ["writer", "critic", "writer", "critic"]
        };
    });

    const result = await runCreateProposal(
      {
        newJobDescription: "Need a TypeScript AI architect",
        maxRevisions: 2
      },
      {
        retrieveRagContext,
        getGlobalStyleProfile,
        runGraph
      }
    );

    expect(callOrder).toEqual(["retrieval", "style", "graph"]);
    expect(result.finalProposal).toBe("Final proposal body");
    expect(result.executionTrace).toEqual(["writer", "critic", "writer", "critic"]);
    expect(result.criticStatus).toBe("APPROVED");
  });

  it("fails when no global style profile exists", async () => {
    await expect(
      runCreateProposal(
        {
          newJobDescription: "Need proposal generation"
        },
        {
          retrieveRagContext: vi.fn().mockResolvedValue([]),
          getGlobalStyleProfile: vi.fn().mockResolvedValue(null),
          runGraph: vi.fn()
        }
      )
    ).rejects.toThrow("No style profile found for proposal generation.");
  });

  it("normalizes html before retrieval embedding and graph state", async () => {
    const embed = vi.fn().mockResolvedValue([0.44, 0.55, 0.66]);
    const vectorSearch = vi.fn().mockResolvedValue([{ _id: "raw_1", _score: 0.91 }]);
    const getRawJob = vi.fn().mockResolvedValue({
      _id: "raw_1",
      text: "Need React + Convex engineer",
      title: "React engineer",
      techStack: ["React", "Convex"]
    });
    const getProposalByRawJobId = vi.fn().mockResolvedValue({
      _id: "proposal_1",
      text: "I can ship this quickly with clean architecture.",
      styleProfileId: "style_1"
    });
    const getStyleProfileById = vi.fn().mockResolvedValue({
      _id: "style_1",
      writingStyleAnalysis: {
        formality: 7,
        enthusiasm: 6,
        keyVocabulary: ["timeline", "delivery"],
        sentenceStructure: "concise"
      }
    });

    const runGraph = vi.fn(async (initialState) => ({
      ...initialState,
      proposalDraft: "Final proposal body",
      criticFeedback: { status: "APPROVED" as const, critique_points: null },
      executionTrace: ["writer", "critic"]
    }));

    const htmlInput = `
      <html>
        <head>
          <title>React + Convex Platform Build</title>
          <script>window.bigPayload = "${"x".repeat(2000)}";</script>
        </head>
        <body>
          <div data-test="Description">
            <p>Need React + Convex engineer to ship an MVP dashboard.</p>
          </div>
        </body>
      </html>
    `;

    await runCreateProposal(
      {
        newJobDescription: htmlInput,
        maxRevisions: 2
      },
      {
        retrieveRagContext: (args) =>
          runRetrieveRagContext(args, {
            embed,
            vectorSearch,
            getRawJob,
            getProposalByRawJobId,
            getStyleProfileById
          }),
        getGlobalStyleProfile: vi.fn().mockResolvedValue({
          tech_stack: [],
          writing_style_analysis: {
            formality: 7,
            enthusiasm: 6,
            key_vocabulary: ["timeline", "delivery"],
            sentence_structure: "concise"
          },
          project_constraints: []
        }),
        runGraph
      }
    );

    const embeddedInput = embed.mock.calls[0]?.[0];
    expect(embeddedInput).toContain("React + Convex Platform Build");
    expect(embeddedInput).toContain("Need React + Convex engineer");
    expect(embeddedInput).not.toContain("<html");
    expect(embeddedInput).not.toContain("window.bigPayload");

    const graphInput = runGraph.mock.calls[0]?.[0];
    expect(graphInput.newJobDescription).toBe(embeddedInput);
    expect(graphInput.newJobDescription).not.toContain("<");
  });
});
