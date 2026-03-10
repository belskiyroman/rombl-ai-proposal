import { describe, expect, it } from "vitest";

import { rerankHistoricalCases, selectEvidenceSignals, selectFragmentSignals } from "@/src/lib/ai/v2/retrieval";

const jobUnderstanding = {
  jobSummary: "Build and own a SaaS MVP with Next.js and API integrations.",
  clientNeeds: ["ownership", "API integrations", "MVP"],
  mustHaveSkills: ["Next.js", "Node.js"],
  niceToHaveSkills: ["AWS"],
  projectRiskFlags: ["unclear scope"],
  proposalStrategy: {
    tone: "consultative" as const,
    length: "medium" as const,
    focus: ["ownership", "relevant experience", "execution clarity"]
  }
};

describe("rerankHistoricalCases", () => {
  it("keeps only one case per duplicate cluster", () => {
    const ranked = rerankHistoricalCases({
      jobUnderstanding,
      candidates: [
        {
          _id: "case-1",
          clusterId: "cluster-a",
          candidateId: 1,
          canonical: true,
          jobTitle: "Case 1",
          jobExtract: {
            projectType: "MVP",
            domain: "SaaS",
            requiredSkills: ["Next.js"],
            optionalSkills: [],
            stack: ["Next.js", "Node.js"],
            clientNeeds: ["ownership"],
            summary: "Case 1 summary"
          },
          proposalExtract: {
            hook: "Case 1 hook",
            valueProposition: "Case 1 value",
            proofPoints: ["Case 1 proof"],
            tone: "consultative"
          },
          quality: {
            rubric: { relevance: 5, specificity: 4, credibility: 4, tone: 4, clarity: 4, ctaStrength: 4 },
            overall: 0.8,
            humanScore: 0.78,
            specificityScore: 0.82,
            genericnessScore: 0.16
          },
          outcome: { interview: true }
        },
        {
          _id: "case-2",
          clusterId: "cluster-a",
          candidateId: 1,
          canonical: true,
          jobTitle: "Case 2",
          jobExtract: {
            projectType: "MVP",
            domain: "SaaS",
            requiredSkills: ["Next.js"],
            optionalSkills: [],
            stack: ["Next.js"],
            clientNeeds: ["ownership"],
            summary: "Case 2 summary"
          },
          proposalExtract: {
            hook: "Case 2 hook",
            valueProposition: "Case 2 value",
            proofPoints: ["Case 2 proof"],
            tone: "consultative"
          },
          quality: {
            rubric: { relevance: 4, specificity: 4, credibility: 4, tone: 4, clarity: 4, ctaStrength: 4 },
            overall: 0.7,
            humanScore: 0.7,
            specificityScore: 0.74,
            genericnessScore: 0.2
          },
          outcome: {}
        },
        {
          _id: "case-3",
          clusterId: "cluster-b",
          candidateId: 1,
          canonical: true,
          jobTitle: "Case 3",
          jobExtract: {
            projectType: "MVP",
            domain: "Marketplace",
            requiredSkills: ["Node.js"],
            optionalSkills: [],
            stack: ["Node.js"],
            clientNeeds: ["API integrations"],
            summary: "Case 3 summary"
          },
          proposalExtract: {
            hook: "Case 3 hook",
            valueProposition: "Case 3 value",
            proofPoints: ["Case 3 proof"],
            tone: "technical"
          },
          quality: {
            rubric: { relevance: 4, specificity: 4, credibility: 4, tone: 4, clarity: 4, ctaStrength: 3 },
            overall: 0.72,
            humanScore: 0.7,
            specificityScore: 0.76,
            genericnessScore: 0.2
          },
          outcome: { reply: true }
        }
      ],
      summaryMatches: [
        { id: "case-1", score: 0.94 },
        { id: "case-2", score: 0.9 },
        { id: "case-3", score: 0.89 }
      ],
      needsMatches: [
        { id: "case-1", score: 0.92 },
        { id: "case-2", score: 0.91 },
        { id: "case-3", score: 0.88 }
      ],
      limit: 3
    });

    expect(ranked).toHaveLength(2);
    expect(ranked.map((item) => item.clusterId)).toEqual(["cluster-a", "cluster-b"]);
  });
});

describe("selectFragmentSignals", () => {
  it("returns the configured opening/proof/closing counts", () => {
    const selection = selectFragmentSignals({
      jobUnderstanding,
      fragments: [
        { _id: "o1", clusterId: "a", candidateId: 1, fragmentType: "opening", text: "Opening A", tags: ["ownership"], specificityScore: 0.8, genericnessScore: 0.2, qualityScore: 0.8, retrievalEligible: true },
        { _id: "o2", clusterId: "b", candidateId: 1, fragmentType: "opening", text: "Opening B", tags: ["MVP"], specificityScore: 0.8, genericnessScore: 0.1, qualityScore: 0.82, retrievalEligible: true },
        { _id: "p1", clusterId: "a", candidateId: 1, fragmentType: "proof", text: "Proof A", tags: ["Next.js"], specificityScore: 0.82, genericnessScore: 0.12, qualityScore: 0.85, retrievalEligible: true },
        { _id: "p2", clusterId: "b", candidateId: 1, fragmentType: "proof", text: "Proof B", tags: ["Node.js"], specificityScore: 0.8, genericnessScore: 0.1, qualityScore: 0.84, retrievalEligible: true },
        { _id: "p3", clusterId: "c", candidateId: 1, fragmentType: "proof", text: "Proof C", tags: ["API integrations"], specificityScore: 0.84, genericnessScore: 0.08, qualityScore: 0.86, retrievalEligible: true },
        { _id: "c1", clusterId: "d", candidateId: 1, fragmentType: "closing", text: "Closing A", tags: ["cta"], specificityScore: 0.75, genericnessScore: 0.15, qualityScore: 0.8, retrievalEligible: true }
      ]
    });

    expect(selection.openings).toHaveLength(2);
    expect(selection.proofs).toHaveLength(3);
    expect(selection.closings).toHaveLength(1);
  });
});

describe("selectEvidenceSignals", () => {
  it("enforces evidence coverage across project, tech, and responsibility/domain", () => {
    const selected = selectEvidenceSignals({
      jobUnderstanding,
      evidenceCandidates: [
        { _id: "e1", candidateId: 1, type: "project", text: "Project evidence", tags: ["MVP"], techStack: ["Next.js"], domains: ["SaaS"], confidence: 0.9, active: true, source: "candidate_profile" },
        { _id: "e2", candidateId: 1, type: "impact", text: "Impact evidence", tags: ["ownership"], techStack: ["Node.js"], domains: ["SaaS"], confidence: 0.88, active: true, source: "case_inference" },
        { _id: "e3", candidateId: 1, type: "tech", text: "Tech evidence", tags: ["Next.js"], techStack: ["Next.js", "Node.js"], domains: ["SaaS"], confidence: 0.86, active: true, source: "candidate_profile" },
        { _id: "e4", candidateId: 1, type: "responsibility", text: "Responsibility evidence", tags: ["ownership"], techStack: ["Node.js"], domains: ["SaaS"], confidence: 0.84, active: true, source: "case_inference" },
        { _id: "e5", candidateId: 1, type: "achievement", text: "Achievement evidence", tags: ["delivery"], techStack: ["AWS"], domains: ["SaaS"], confidence: 0.7, active: true, source: "case_inference" }
      ]
    });

    expect(selected).toHaveLength(4);
    expect(selected.some((item) => item.type === "tech")).toBe(true);
    expect(selected.some((item) => item.type === "responsibility" || item.type === "domain")).toBe(true);
    expect(selected.filter((item) => item.type === "project" || item.type === "impact").length).toBeGreaterThanOrEqual(2);
  });
});
