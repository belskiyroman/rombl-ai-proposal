import { beforeEach, describe, expect, it, vi } from "vitest";

const createProposalEngineRunnersMock = vi.fn(() => ({}));
const runCreateProposalMock = vi.fn();
const ingestHistoricalCaseArtifactsMock = vi.fn();

vi.mock("../../src/lib/proposal-engine/agents", () => ({
  createProposalEngineRunners: createProposalEngineRunnersMock
}));

vi.mock("../../src/lib/proposal-engine/service", () => ({
  runCreateProposal: runCreateProposalMock,
  runRetrieveProposalContext: vi.fn()
}));

vi.mock("../../src/lib/ai/embeddings", () => ({
  generateEmbeddingWithTelemetry: vi.fn()
}));

vi.mock("../../convex/cases", async () => {
  const actual = await vi.importActual<typeof import("../../convex/cases")>("../../convex/cases");

  return {
    ...actual,
    ingestHistoricalCaseArtifacts: ingestHistoricalCaseArtifactsMock
  };
});

const {
  buildGeneratedProposalLibraryText,
  buildGeneratedHistoricalCaseInput,
  createProposal,
  runProposalForProgress
} = await import("@/convex/generate");

function createResult(overrides: Partial<Awaited<ReturnType<typeof runCreateProposalMock>>> = {}) {
  return {
    finalProposal: "Grounded final cover letter.",
    coverLetterCharCount: 28,
    questionAnswers: [],
    unresolvedQuestions: [],
    approvalStatus: "APPROVED" as const,
    critiqueHistory: [],
    executionTrace: ["job_understanding", "write_draft", "critique"],
    selectedEvidence: [],
    retrievedContext: {
      similarCases: [],
      fragments: {
        openings: [],
        proofs: [],
        closings: []
      },
      evidenceCandidates: []
    },
    jobUnderstanding: {
      jobSummary: "Build an AI CRM system.",
      clientNeeds: ["AI automation"],
      mustHaveSkills: ["AI"],
      niceToHaveSkills: [],
      projectRiskFlags: [],
      proposalStrategy: {
        tone: "consultative" as const,
        length: "medium" as const,
        focus: ["AI automation"]
      }
    },
    proposalPlan: {
      openingAngle: "Lead with similar delivery.",
      mainPoints: ["AI feature delivery"],
      selectedEvidenceIds: [],
      selectedFragmentIds: [],
      avoid: [],
      ctaStyle: "Clear CTA"
    },
    draftHistory: ["Draft 1"],
    copyRisk: {
      triggered: false,
      maxParagraphCosine: 0,
      trigramOverlap: 0,
      matchedCaseIds: [],
      matchedFragmentIds: [],
      reasons: []
    },
    stepTelemetry: [],
    telemetrySummary: {
      totalSteps: 0,
      totalDurationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalReasoningTokens: 0
    },
    state: {
      candidateProfile: {
        candidateId: 1,
        displayName: "Yurii Shepitko",
        positioningSummary: "Senior full-stack engineer",
        toneProfile: "consultative" as const,
        coreDomains: ["SaaS"],
        preferredCtaStyle: "Clear CTA",
        externalProfiles: {}
      },
      jobInput: {
        title: "AI CRM System",
        description: "Need an AI CRM system with automation.",
        proposalQuestions: []
      },
      jobUnderstanding: null,
      retrievedContext: null,
      selectedEvidence: [],
      proposalPlan: null,
      currentDraft: "",
      draftHistory: [],
      latestCritique: null,
      critiqueHistory: [],
      copyRisk: null,
      finalProposal: "",
      questionAnswers: [],
      unresolvedQuestions: [],
      revisionCount: 0,
      maxRevisions: 2,
      executionTrace: [],
      stepTelemetry: []
    },
    ...overrides
  };
}

function createCtx() {
  const mutationCalls: unknown[] = [];

  return {
    mutationCalls,
    ctx: {
      runQuery: vi.fn(),
      vectorSearch: vi.fn(),
      runMutation: vi.fn(async (_mutationRef: unknown, mutationArgs: unknown) => {
        mutationCalls.push(mutationArgs);

        if (
          typeof mutationArgs === "object" &&
          mutationArgs !== null &&
          "document" in mutationArgs
        ) {
          return "generation_run_1";
        }

        return true;
      })
    }
  };
}

describe("generated proposal Library auto-add", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCreateProposalMock.mockResolvedValue(createResult());
    ingestHistoricalCaseArtifactsMock.mockResolvedValue({
      historicalCaseId: "case_1",
      clusterId: "cluster_1",
      canonical: true,
      fragmentIds: [],
      evidenceIds: [],
      jobExtract: {},
      proposalExtract: {},
      quality: {}
    });
  });

  it("builds Library proposal text from the cover letter only when there are no answers", () => {
    expect(
      buildGeneratedProposalLibraryText({
        finalProposal: "Grounded final cover letter.",
        questionAnswers: []
      })
    ).toBe("Grounded final cover letter.");
  });

  it("builds ordered Q&A text and omits unresolved questions from the Library proposal text", () => {
    const proposalText = buildGeneratedHistoricalCaseInput({
      candidateId: 1,
      jobInput: {
        title: "AI CRM System",
        description: "Need an AI CRM system with automation and custom workflows.",
        proposalQuestions: [
          {
            position: 1,
            prompt: "Describe your recent experience with similar projects"
          },
          {
            position: 2,
            prompt: "Include a link to your GitHub profile and/or website"
          },
          {
            position: 3,
            prompt: "Unsupported question"
          }
        ]
      },
      result: createResult({
        questionAnswers: [
          {
            position: 2,
            prompt: "Include a link to your GitHub profile and/or website",
            answer: "GitHub: https://github.com/yurii"
          },
          {
            position: 1,
            prompt: "Describe your recent experience with similar projects",
            answer: "Recent work includes AI-assisted CRM and workflow automation systems."
          }
        ],
        unresolvedQuestions: [
          {
            position: 3,
            prompt: "Unsupported question",
            reason: "No grounded answer."
          }
        ]
      })
    }).proposalText;

    expect(proposalText).toContain("Grounded final cover letter.");
    expect(proposalText).toContain("Proposal Questions & Answers");
    expect(proposalText).toContain("Q1: Describe your recent experience with similar projects");
    expect(proposalText).toContain("A1: Recent work includes AI-assisted CRM and workflow automation systems.");
    expect(proposalText).toContain("Q2: Include a link to your GitHub profile and/or website");
    expect(proposalText).toContain("A2: GitHub: https://github.com/yurii");
    expect(proposalText).not.toContain("Unsupported question");
  });

  it("uses the job understanding summary as the fallback Library title and auto-ingests on manual generation", async () => {
    const { ctx } = createCtx();

    const response = await createProposal._handler(ctx as never, {
      candidateId: 1,
      jobInput: {
        description: "Need an AI CRM system with automation and custom workflows.",
        proposalQuestions: [
          {
            position: 1,
            prompt: "Include a link to your GitHub profile and/or website"
          }
        ]
      }
    });

    expect(response.generationRunId).toBe("generation_run_1");
    expect(ingestHistoricalCaseArtifactsMock).toHaveBeenCalledTimes(1);
    expect(ingestHistoricalCaseArtifactsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateId: 1,
        jobTitle: "Build an AI CRM system.",
        jobDescription: "Need an AI CRM system with automation and custom workflows.",
        proposalText: "Grounded final cover letter."
      })
    );
  });

  it("keeps async generation completed when Library auto-add fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ingestHistoricalCaseArtifactsMock.mockRejectedValueOnce(new Error("library unavailable"));

    const { ctx, mutationCalls } = createCtx();

    await expect(
      runProposalForProgress._handler(ctx as never, {
        candidateId: 1,
        progressId: "progress_1" as never,
        jobInput: {
          title: "AI CRM System",
          description: "Need an AI CRM system with automation and custom workflows.",
          proposalQuestions: []
        }
      })
    ).resolves.toBeNull();

    expect(ingestHistoricalCaseArtifactsMock).toHaveBeenCalledTimes(1);
    expect(
      mutationCalls.some(
        (args) =>
          typeof args === "object" &&
          args !== null &&
          "generationRunId" in args
      )
    ).toBe(true);
    expect(
      mutationCalls.some(
        (args) =>
          typeof args === "object" &&
          args !== null &&
          "errorMessage" in args
      )
    ).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
