import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/proposal-engine/agents", () => ({
  buildCandidateEvidencePrompt: ({
    candidateSummary
  }: {
    candidateSummary: string;
  }) => candidateSummary,
  createProposalEngineRunners: vi.fn(() => ({
    extractCandidateEvidence: {
      invoke: vi.fn(async (candidateSummary: string) => {
        if (candidateSummary.includes("positioning summary")) {
          return {
            blocks: [
              {
                type: "project",
                text: "Built production systems with Next.js and Node.js.",
                tags: ["Next.js"],
                title: "Production systems",
                techStack: ["Next.js", "Node.js"],
                domains: ["SaaS"],
                impactSummary: "Delivered end-to-end features."
              }
            ]
          };
        }

        return {
          blocks: [
            {
              type: "project",
              text: "Built production systems with Next.js and Node.js.",
              tags: ["Next.js"],
              title: "Production systems",
              techStack: ["Next.js", "Node.js"],
              domains: ["SaaS"],
              impactSummary: "Delivered end-to-end features."
            },
            {
              type: "achievement",
              text: "Shipped migration work across millions of records.",
              tags: ["migration"],
              title: "Migration delivery",
              techStack: ["MongoDB"],
              domains: ["Content Platforms"],
              impactSummary: "Handled large-scale data migration."
            }
          ]
        };
      })
    }
  }))
}));

vi.mock("../../src/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn(async (text: string) => [text.length])
}));

const { seedCandidateProfile } = await import("@/convex/profiles");

describe("seedCandidateProfile", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates and then replaces candidate_profile evidence on rerun without duplicates", async () => {
    const state = {
      profile: null as null | {
        _id: string;
        displayName: string;
        preferredCtaStyle: string;
        metadata: {
          notes?: string;
          externalProfiles?: {
            githubUrl?: string;
            websiteUrl?: string;
            portfolioUrl?: string;
          };
        };
      },
      evidence: [] as Array<{
        _id: string;
        candidateId: number;
        text: string;
        type: string;
      }>
    };

    const ctx = {
      runMutation: vi.fn(async (_mutationRef: unknown, mutationArgs: unknown) => {
        if (
          typeof mutationArgs === "object" &&
          mutationArgs !== null &&
          "document" in mutationArgs
        ) {
          const { document } = mutationArgs as {
            document: {
              displayName: string;
              preferredCtaStyle: string;
              metadata: {
                notes?: string;
                externalProfiles?: {
                  githubUrl?: string;
                  websiteUrl?: string;
                  portfolioUrl?: string;
                };
              };
            };
          };

          state.profile = {
            _id: "profile_1",
            displayName: document.displayName,
            preferredCtaStyle: document.preferredCtaStyle,
            metadata: document.metadata
          };

          return "profile_1";
        }

        if (
          typeof mutationArgs === "object" &&
          mutationArgs !== null &&
          "candidateId" in mutationArgs &&
          "documents" in mutationArgs
        ) {
          const { documents } = mutationArgs as {
            documents: Array<{
              candidateId: number;
              text: string;
              type: string;
            }>;
          };

          state.evidence = documents.map((document, index) => ({
            _id: `evidence_${index + 1}`,
            candidateId: document.candidateId,
            text: document.text,
            type: document.type
          }));

          return state.evidence.map((document) => document._id);
        }

        throw new Error("Unexpected mutation call");
      })
    };

    const firstResult = await seedCandidateProfile._handler(ctx as never, {
      candidateId: 1,
      displayName: "Yurii Shepitko",
      positioningSummary: "This positioning summary should produce profile-derived evidence.",
      toneProfile: "consultative",
      coreDomains: ["SaaS", "Content Platforms"],
      preferredCtaStyle: "Clear CTA",
      metadata: {
        notes: "Founder-friendly engineer.\n\nAdditional tone signals: confident, technical, founder-like.",
        externalProfiles: {
          githubUrl: "https://github.com/yurii"
        }
      },
      rawEvidenceText: "Raw evidence text for migration delivery and production systems."
    });

    expect(firstResult).toEqual({
      profileId: "profile_1",
      candidateId: 1,
      evidenceCount: 2
    });
    expect(state.profile?.metadata.notes).toContain("Additional tone signals");
    expect(state.profile?.metadata.externalProfiles).toEqual({
      githubUrl: "https://github.com/yurii"
    });
    expect(state.evidence).toHaveLength(2);
    expect(state.evidence.map((document) => document.text)).toEqual([
      "Built production systems with Next.js and Node.js.",
      "Shipped migration work across millions of records."
    ]);

    const secondResult = await seedCandidateProfile._handler(ctx as never, {
      candidateId: 1,
      displayName: "Yurii Shepitko",
      positioningSummary: "This positioning summary should produce profile-derived evidence.",
      toneProfile: "consultative",
      coreDomains: ["SaaS", "Content Platforms"],
      preferredCtaStyle: "Updated CTA",
      metadata: {
        notes: "Founder-friendly engineer.\n\nAdditional tone signals: confident, technical, founder-like.",
        externalProfiles: {
          websiteUrl: "https://example.com"
        }
      },
      rawEvidenceText: "Raw evidence text for migration delivery and production systems."
    });

    expect(secondResult.evidenceCount).toBe(2);
    expect(state.profile?.preferredCtaStyle).toBe("Updated CTA");
    expect(state.profile?.metadata.externalProfiles).toEqual({
      websiteUrl: "https://example.com"
    });
    expect(state.evidence).toHaveLength(2);
    expect(new Set(state.evidence.map((document) => `${document.type}:${document.text}`)).size).toBe(2);
  });
});
