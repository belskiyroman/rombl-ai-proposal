import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMutationMock = vi.fn();

vi.mock("convex/nextjs", () => ({
  fetchMutation: fetchMutationMock
}));

describe("extension handoff API", () => {
  beforeEach(() => {
    fetchMutationMock.mockReset();
  });

  it("accepts valid payloads and returns a generate URL", async () => {
    fetchMutationMock.mockResolvedValue("handoff_123");
    const { POST } = await import("@/app/api/extension/handoffs/route");

    const response = await POST(
      new Request("http://localhost:3000/api/extension/handoffs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceSite: "upwork",
          sourceUrl: "https://www.upwork.com/freelance-jobs/apply/Test_~01/",
          pageTitle: "Senior Next.js Engineer - Upwork",
          jobTitle: "Senior Next.js Engineer",
          jobDescription:
            "We need a senior engineer to own the architecture, delivery, and integrations for a production SaaS dashboard.",
          capturedAt: 123456
        })
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({
      handoffId: "handoff_123",
      generateUrl: "http://localhost:3000/generate?handoff=handoff_123"
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects invalid payloads", async () => {
    const { POST } = await import("@/app/api/extension/handoffs/route");

    const response = await POST(
      new Request("http://localhost:3000/api/extension/handoffs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceSite: "upwork",
          sourceUrl: "not-a-url"
        })
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.message).toBe("Invalid extension handoff payload");
    expect(fetchMutationMock).not.toHaveBeenCalled();
  });

  it("supports preflight requests for extension POST calls", async () => {
    const { OPTIONS } = await import("@/app/api/extension/handoffs/route");
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
