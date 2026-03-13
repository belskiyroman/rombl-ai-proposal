import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMutationMock = vi.fn();
const fetchQueryMock = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchMutation: fetchMutationMock,
  fetchQuery: fetchQueryMock
}));

describe("extension generate API", () => {
  beforeEach(() => {
    fetchMutationMock.mockReset();
    fetchQueryMock.mockReset();
  });

  it("returns candidate summaries for the side panel picker", async () => {
    fetchQueryMock.mockResolvedValue([
      {
        _id: "candidate_doc_1",
        candidateId: 7,
        displayName: "Roman",
        toneProfile: "consultative",
        coreDomains: ["SaaS"],
        preferredCtaStyle: "Short CTA",
        updatedAt: 123
      }
    ]);

    const { GET } = await import("@/app/api/extension/candidates/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.candidates).toHaveLength(1);
    expect(json.candidates[0]?.candidateId).toBe(7);
  });

  it("starts async generation and returns a progress id", async () => {
    fetchMutationMock.mockResolvedValue({
      progressId: "progress_123"
    });

    const { POST } = await import("@/app/api/extension/generate/route");
    const response = await POST(
      new Request("http://localhost:3000/api/extension/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          candidateId: 7,
          title: "Senior Backend Engineer",
          description:
            "Need a senior backend engineer to own production APIs, MongoDB performance, and critical integrations.",
          sourceSite: "upwork",
          sourceUrl: "https://www.upwork.com/jobs/~01"
        })
      })
    );
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json).toEqual({
      progressId: "progress_123"
    });
  });

  it("returns running or completed status snapshots", async () => {
    fetchQueryMock
      .mockResolvedValueOnce({
        _id: "progress_123",
        candidateId: 7,
        jobInput: {
          title: "Senior Backend Engineer",
          description: "Need a senior backend engineer to own production APIs and integrations."
        },
        status: "COMPLETED",
        currentStep: null,
        steps: [],
        startedAt: 10,
        updatedAt: 20,
        completedAt: 30,
        totalDurationMs: 20,
        generationRunId: "run_123"
      })
      .mockResolvedValueOnce({
        generationRunId: "run_123",
        finalProposal: "Final proposal text",
        approvalStatus: "APPROVED",
        createdAt: 30
      });

    const { GET } = await import("@/app/api/extension/generate/status/route");
    const response = await GET(new Request("http://localhost:3000/api/extension/generate/status?id=progress_123"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.progress.status).toBe("COMPLETED");
    expect(json.result.generationRunId).toBe("run_123");
    expect(json.result.finalProposal).toBe("Final proposal text");
  });
});
