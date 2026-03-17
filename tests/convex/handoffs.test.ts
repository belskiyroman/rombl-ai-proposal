import { describe, expect, it } from "vitest";

import { buildGenerationHandoffDocument, resolveGenerationHandoffRecord } from "@/convex/handoffs";
import { generationHandoffTtlMs } from "@/src/lib/generation-handoff";

describe("generation handoffs", () => {
  it("creates temporary handoff documents with a 24-hour TTL", () => {
    const document = buildGenerationHandoffDocument({
      sourceSite: "upwork",
      sourceUrl: "https://www.upwork.com/jobs/~01",
      pageTitle: "Senior Backend Engineer - Upwork",
      jobTitle: "Senior Backend Engineer",
      jobDescription: "Need a senior backend engineer to own MongoDB performance, Node.js APIs, and production support.",
      proposalQuestions: [],
      capturedAt: 1000,
      createdAt: 2000
    });

    expect(document.expiresAt).toBe(2000 + generationHandoffTtlMs);
    expect(document.pageTitle).toBe("Senior Backend Engineer - Upwork");
  });

  it("resolves missing and expired records safely", () => {
    expect(resolveGenerationHandoffRecord(null, 1000)).toEqual({
      status: "missing"
    });

    expect(
      resolveGenerationHandoffRecord(
        {
          _id: "handoff_1",
          sourceSite: "upwork",
          sourceUrl: "https://www.upwork.com/jobs/~01",
          pageTitle: "Title",
          jobTitle: "Title",
          jobDescription: "A sufficiently detailed job description for the handoff flow to accept.",
          capturedAt: 1000,
          createdAt: 2000,
          expiresAt: 2500
        },
        3000
      )
    ).toEqual({
      status: "expired"
    });
  });

  it("returns available handoffs when still within TTL", () => {
    const resolved = resolveGenerationHandoffRecord(
      {
        _id: "handoff_1",
        sourceSite: "upwork",
        sourceUrl: "https://www.upwork.com/jobs/~01",
        pageTitle: "Title",
        jobTitle: "Title",
        jobDescription: "A sufficiently detailed job description for the handoff flow to accept.",
        capturedAt: 1000,
        createdAt: 2000,
        expiresAt: 5000
      },
      3000
    );

    expect(resolved.status).toBe("available");
    if (resolved.status === "available") {
      expect(resolved.handoff._id).toBe("handoff_1");
    }
  });

  it("normalizes missing proposal questions on legacy handoff records", () => {
    const resolved = resolveGenerationHandoffRecord(
      {
        _id: "handoff_legacy",
        sourceSite: "upwork",
        sourceUrl: "https://www.upwork.com/jobs/~01",
        pageTitle: "Title",
        jobTitle: "Title",
        jobDescription: "A sufficiently detailed job description for the handoff flow to accept.",
        capturedAt: 1000,
        createdAt: 2000,
        expiresAt: 5000
      } as any,
      3000
    );

    expect(resolved.status).toBe("available");
    if (resolved.status === "available") {
      expect(resolved.handoff.proposalQuestions).toEqual([]);
    }
  });
});
