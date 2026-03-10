import { describe, expect, it } from "vitest";

import { createProposalFragments, decideClusterForProposal, deriveSeedEvidenceBlocks } from "@/src/lib/proposal-engine/offline";

describe("offline clustering", () => {
  it("creates a new cluster when similarity is below threshold", () => {
    const decision = decideClusterForProposal(
      "Unique proposal about architecture ownership and integrations.",
      {
        specificityScore: 0.84,
        genericnessScore: 0.18
      },
      {},
      [
        {
          id: "case-1",
          clusterId: "cluster-1",
          normalizedProposalText: "Different proposal about UI polish only.",
          quality: {
            specificityScore: 0.7,
            genericnessScore: 0.2
          },
          outcome: {}
        }
      ]
    );

    expect(decision.duplicateMethod).toBe("new_cluster");
    expect(decision.newCaseBecomesRepresentative).toBe(true);
  });

  it("treats an identical proposal as an exact duplicate", () => {
    const decision = decideClusterForProposal(
      "Exact duplicate proposal text",
      {
        specificityScore: 0.8,
        genericnessScore: 0.2
      },
      {},
      [
        {
          id: "case-1",
          clusterId: "cluster-1",
          normalizedProposalText: "Exact duplicate proposal text",
          quality: {
            specificityScore: 0.8,
            genericnessScore: 0.2
          },
          outcome: {}
        }
      ]
    );

    expect(decision.duplicateMethod).toBe("exact");
    expect(decision.clusterId).toBe("cluster-1");
  });
});

describe("offline artifacts", () => {
  const proposalExtract = {
    hook: "You need someone who can own the MVP architecture from the start.",
    valueProposition: "I can take this from scope to shipped product.",
    experienceClaims: ["Built SaaS MVPs end-to-end"],
    techMapping: ["Next.js", "Node.js"],
    proofPoints: ["Shipped production systems with API integrations"],
    cta: "If useful, I can outline the first delivery milestones.",
    tone: "consultative" as const,
    lengthBucket: "medium" as const,
    specificityScore: 0.82,
    genericnessScore: 0.16
  };

  const jobExtract = {
    projectType: "MVP",
    domain: "SaaS",
    requiredSkills: ["Next.js"],
    optionalSkills: ["AWS"],
    senioritySignals: ["senior"],
    deliverables: ["MVP"],
    constraints: ["tight timeline"],
    stack: ["Next.js", "Node.js"],
    softSignals: ["ownership", "communication"],
    jobLengthBucket: "medium" as const,
    clientNeeds: ["ownership", "API integrations"],
    summary: "Build and own a SaaS MVP with Next.js and Node.js."
  };

  it("creates reusable opening/proof/closing fragments", () => {
    const fragments = createProposalFragments(proposalExtract, {
      overall: 0.78,
      specificityScore: 0.82,
      genericnessScore: 0.16
    });

    expect(fragments.some((fragment) => fragment.fragmentType === "opening")).toBe(true);
    expect(fragments.some((fragment) => fragment.fragmentType === "proof")).toBe(true);
    expect(fragments.some((fragment) => fragment.fragmentType === "closing")).toBe(true);
  });

  it("derives seed evidence blocks from proposal and job extracts", () => {
    const evidence = deriveSeedEvidenceBlocks(proposalExtract, jobExtract);

    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some((item) => item.type === "project")).toBe(true);
    expect(evidence.some((item) => item.type === "tech")).toBe(true);
  });
});
