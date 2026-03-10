import { describe, expect, it } from "vitest";

import { buildGenerationRunDetail, buildGenerationRunListItem } from "@/convex/runs";

describe("buildGenerationRunListItem", () => {
  it("uses title fallback rules and normalizes proposal previews", () => {
    const item = buildGenerationRunListItem({
      _id: "run_1",
      candidateId: 4,
      createdAt: 1000,
      jobInput: {
        description: "Need a strong full-stack engineer."
      },
      jobUnderstanding: {
        jobSummary: "Need a strong full-stack engineer.",
        clientNeeds: ["ownership"],
        mustHaveSkills: ["Next.js"],
        niceToHaveSkills: [],
        projectRiskFlags: [],
        proposalStrategy: {
          tone: "consultative",
          length: "medium",
          focus: ["ownership"]
        }
      },
      selectedEvidence: [],
      proposalPlan: {
        openingAngle: "Lead with ownership",
        mainPoints: [],
        selectedEvidenceIds: [],
        selectedFragmentIds: [],
        avoid: [],
        ctaStyle: "Short CTA"
      },
      draftHistory: ["draft-1", "draft-2"],
      critiqueHistory: [
        {
          rubric: {
            relevance: 0.8,
            specificity: 0.7,
            credibility: 0.8,
            tone: 0.7,
            clarity: 0.8,
            ctaStrength: 0.7
          },
          issues: ["Too generic"],
          revisionInstructions: ["Tighten opening"],
          approvalStatus: "NEEDS_REVISION",
          copyRisk: {
            triggered: false,
            maxParagraphCosine: 0.1,
            trigramOverlap: 0.05,
            matchedCaseIds: [],
            matchedFragmentIds: [],
            reasons: []
          }
        }
      ],
      copyRisk: {
        triggered: true,
        maxParagraphCosine: 0.2,
        trigramOverlap: 0.06,
        matchedCaseIds: [],
        matchedFragmentIds: [],
        reasons: ["overlap"]
      },
      finalProposal: "  This proposal preview should be normalized to a single line.\n\nIt should also keep spacing tidy. ",
      approvalStatus: "NEEDS_REVISION"
    });

    expect(item.jobTitle).toBe("Need a strong full-stack engineer.");
    expect(item.revisionCount).toBe(1);
    expect(item.copyRiskTriggered).toBe(true);
    expect(item.finalProposalPreview).toBe(
      "This proposal preview should be normalized to a single line. It should also keep spacing tidy."
    );
  });
});

describe("buildGenerationRunDetail", () => {
  it("falls back gracefully when optional snapshots are missing", () => {
    const detail = buildGenerationRunDetail({
      _id: "run_2",
      candidateId: 11,
      createdAt: 2000,
      jobInput: {
        title: "Backend Architect",
        description: "Need backend architecture help."
      },
      jobUnderstanding: {
        jobSummary: "Need backend architecture help.",
        clientNeeds: ["architecture"],
        mustHaveSkills: ["Node.js"],
        niceToHaveSkills: ["AWS"],
        projectRiskFlags: ["scope risk"],
        proposalStrategy: {
          tone: "technical",
          length: "medium",
          focus: ["architecture"]
        }
      },
      selectedEvidence: [],
      proposalPlan: {
        openingAngle: "Lead with architecture",
        mainPoints: ["Architecture"],
        selectedEvidenceIds: [],
        selectedFragmentIds: [],
        avoid: [],
        ctaStyle: "Short CTA"
      },
      draftHistory: ["draft-1"],
      critiqueHistory: [],
      copyRisk: {
        triggered: false,
        maxParagraphCosine: 0,
        trigramOverlap: 0,
        matchedCaseIds: [],
        matchedFragmentIds: [],
        reasons: []
      },
      finalProposal: "Saved proposal body",
      approvalStatus: "APPROVED"
    });

    expect(detail.generationRunId).toBe("run_2");
    expect(detail.candidateSnapshot.displayName).toBe("Candidate #11");
    expect(detail.executionTrace).toEqual([]);
    expect(detail.stepTelemetry).toEqual([]);
    expect(detail.telemetrySummary.totalTokens).toBe(0);
    expect(detail.retrievedContext.similarCases).toEqual([]);
    expect(detail.retrievedContext.fragments.openings).toEqual([]);
    expect(detail.retrievedContext.evidenceCandidates).toEqual([]);
  });

  it("keeps saved telemetry when it exists", () => {
    const detail = buildGenerationRunDetail({
      _id: "run_3",
      candidateId: 9,
      createdAt: 3000,
      jobInput: {
        title: "Full-stack Owner",
        description: "Need a full-stack owner."
      },
      jobUnderstanding: {
        jobSummary: "Need a full-stack owner.",
        clientNeeds: ["ownership"],
        mustHaveSkills: ["Next.js"],
        niceToHaveSkills: [],
        projectRiskFlags: [],
        proposalStrategy: {
          tone: "consultative",
          length: "medium",
          focus: ["ownership"]
        }
      },
      selectedEvidence: [],
      proposalPlan: {
        openingAngle: "Lead with ownership",
        mainPoints: [],
        selectedEvidenceIds: [],
        selectedFragmentIds: [],
        avoid: [],
        ctaStyle: "Short CTA"
      },
      draftHistory: ["draft-1"],
      critiqueHistory: [],
      copyRisk: {
        triggered: false,
        maxParagraphCosine: 0,
        trigramOverlap: 0,
        matchedCaseIds: [],
        matchedFragmentIds: [],
        reasons: []
      },
      finalProposal: "Saved proposal body",
      approvalStatus: "APPROVED",
      stepTelemetry: [
        {
          step: "job_understanding",
          stage: "job_understanding",
          kind: "llm",
          startedAt: 100,
          finishedAt: 350,
          durationMs: 250,
          model: "gpt-5-mini",
          attempt: 1,
          tokenUsage: {
            inputTokens: 90,
            outputTokens: 30,
            totalTokens: 120,
            reasoningTokens: 0
          }
        }
      ],
      telemetrySummary: {
        totalSteps: 1,
        totalDurationMs: 250,
        totalInputTokens: 90,
        totalOutputTokens: 30,
        totalTokens: 120,
        totalReasoningTokens: 0
      }
    });

    expect(detail.stepTelemetry).toHaveLength(1);
    expect(detail.stepTelemetry[0]?.model).toBe("gpt-5-mini");
    expect(detail.telemetrySummary.totalTokens).toBe(120);
  });
});
