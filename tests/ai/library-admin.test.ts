import { describe, expect, it } from "vitest";

import { computeClusterQualityScore, selectRepresentativeCase, sortClusterCases } from "@/src/lib/proposal-engine/library-admin";

describe("library admin helpers", () => {
  it("selects the best representative using outcome and quality tie-breaks", () => {
    const representative = selectRepresentativeCase([
      {
        _id: "case_a",
        candidateId: 1,
        clusterId: "cluster_1",
        canonical: true,
        jobTitle: "Case A",
        normalizedProposalText: "built a marketplace with next js",
        proposalExtract: { hook: "Case A hook" },
        quality: {
          overall: 0.7,
          humanScore: 0.7,
          specificityScore: 0.7,
          genericnessScore: 0.3
        },
        outcome: {
          reply: true
        },
        createdAt: 1,
        updatedAt: 1
      },
      {
        _id: "case_b",
        candidateId: 1,
        clusterId: "cluster_1",
        canonical: false,
        jobTitle: "Case B",
        normalizedProposalText: "built a marketplace with next js and node",
        proposalExtract: { hook: "Case B hook" },
        quality: {
          overall: 0.85,
          humanScore: 0.82,
          specificityScore: 0.88,
          genericnessScore: 0.1
        },
        outcome: {
          reply: true,
          interview: true
        },
        createdAt: 2,
        updatedAt: 2
      }
    ]);

    expect(representative?._id).toBe("case_b");
    expect(computeClusterQualityScore(representative!)).toBeGreaterThan(0.8);
  });

  it("sorts cluster cases with the representative first", () => {
    const cases = sortClusterCases(
      [
        {
          _id: "case_a",
          candidateId: 1,
          clusterId: "cluster_1",
          canonical: false,
          jobTitle: "Older variant",
          normalizedProposalText: "older text",
          proposalExtract: { hook: "Older" },
          quality: {
            overall: 0.6,
            humanScore: 0.6,
            specificityScore: 0.6,
            genericnessScore: 0.2
          },
          createdAt: 1,
          updatedAt: 1
        },
        {
          _id: "case_b",
          candidateId: 1,
          clusterId: "cluster_1",
          canonical: true,
          jobTitle: "Representative",
          normalizedProposalText: "rep text",
          proposalExtract: { hook: "Rep" },
          quality: {
            overall: 0.9,
            humanScore: 0.9,
            specificityScore: 0.9,
            genericnessScore: 0.1
          },
          createdAt: 2,
          updatedAt: 5
        }
      ],
      "case_b"
    );

    expect(cases.map((item) => item._id)).toEqual(["case_b", "case_a"]);
  });
});
