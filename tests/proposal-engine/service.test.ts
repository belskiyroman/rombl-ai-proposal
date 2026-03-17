import { describe, expect, it, vi } from "vitest";

import { runCreateProposal } from "@/src/lib/proposal-engine/service";
import { createProposalEngineInitialState } from "@/src/lib/proposal-engine/state";

function telemetry() {
  return {
    kind: "llm" as const,
    startedAt: 0,
    finishedAt: 1,
    durationMs: 1
  };
}

const baseCandidateProfile = {
  candidateId: 7,
  displayName: "Roman",
  positioningSummary: "Senior full-stack engineer focused on healthcare and MVP delivery.",
  toneProfile: "consultative" as const,
  coreDomains: ["Healthcare", "SaaS"],
  preferredCtaStyle: "Short CTA",
  externalProfiles: {}
};

const baseJobUnderstanding = {
  jobSummary: "Healthcare platform build for clinicians.",
  clientNeeds: ["Healthcare platform delivery", "Full-stack ownership"],
  mustHaveSkills: ["Next.js", "Node.js"],
  niceToHaveSkills: ["HIPAA"],
  projectRiskFlags: [],
  proposalStrategy: {
    tone: "consultative" as const,
    length: "medium" as const,
    focus: ["delivery", "credibility"]
  }
};

const baseRetrievedContext = {
  similarCases: [],
  fragments: {
    openings: [
      {
        _id: "fragment_1",
        clusterId: null,
        candidateId: 7,
        fragmentType: "opening" as const,
        text: "I can help with this healthcare platform.",
        tags: ["healthcare"],
        specificityScore: 0.8,
        genericnessScore: 0.2,
        qualityScore: 0.9,
        retrievalEligible: true
      }
    ],
    proofs: [],
    closings: []
  },
  evidenceCandidates: [
    {
      _id: "evidence_1",
      candidateId: 7,
      type: "project" as const,
      text: "Built HIPAA-compliant healthcare platforms used by clinicians.",
      tags: ["healthcare", "HIPAA"],
      techStack: ["Next.js", "Node.js"],
      domains: ["Healthcare"],
      confidence: 0.95,
      active: true,
      source: "candidate_profile" as const
    }
  ]
};

function buildRunners(args: {
  answerQuestionsInvoke?: (prompt: string) => Promise<{
    answers: Array<{ position: number; prompt: string; answer: string }>;
    unresolved: Array<{ position: number; prompt: string; reason: string }>;
  }>;
  critiqueDraftInvoke?: () => Promise<{
    rubric: {
      relevance: number;
      specificity: number;
      credibility: number;
      tone: number;
      clarity: number;
      ctaStrength: number;
    };
    issues: string[];
    revisionInstructions: string[];
    approvalStatus: "APPROVED" | "NEEDS_REVISION";
    copyRisk: {
      triggered: boolean;
      maxParagraphCosine: number;
      trigramOverlap: number;
      matchedCaseIds: string[];
      matchedFragmentIds: string[];
      reasons: string[];
    };
  }>;
  writeDraftInvoke?: () => Promise<string>;
  reviseDraftInvoke?: (prompt: string) => Promise<string>;
}) {
  return {
    extractJob: {} as never,
    extractProposal: {} as never,
    scoreCaseQuality: {} as never,
    extractCandidateEvidence: {} as never,
    understandJob: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async () => ({
        output: baseJobUnderstanding,
        telemetry: telemetry()
      }))
    },
    selectEvidence: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async () => ({
        output: {
          selectedEvidence: [
            {
              evidenceId: "evidence_1",
              reason: "Direct healthcare delivery proof"
            }
          ]
        },
        telemetry: telemetry()
      }))
    },
    planProposal: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async () => ({
        output: {
          openingAngle: "Lead with healthcare delivery experience.",
          mainPoints: ["Healthcare delivery", "HIPAA familiarity"],
          selectedEvidenceIds: ["evidence_1"],
          selectedFragmentIds: ["fragment_1"],
          avoid: ["generic claims"],
          ctaStyle: "Short CTA"
        },
        telemetry: telemetry()
      }))
    },
    answerQuestions: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async (prompt: string) => ({
        output: args.answerQuestionsInvoke
          ? await args.answerQuestionsInvoke(prompt)
          : {
              answers: [],
              unresolved: []
            },
        telemetry: telemetry()
      }))
    },
    critiqueDraft: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async () => ({
        output: args.critiqueDraftInvoke
          ? await args.critiqueDraftInvoke()
          : {
              rubric: {
                relevance: 5,
                specificity: 5,
                credibility: 5,
                tone: 5,
                clarity: 5,
                ctaStrength: 5
              },
              issues: [],
              revisionInstructions: [],
              approvalStatus: "APPROVED" as const,
              copyRisk: {
                triggered: false,
                maxParagraphCosine: 0,
                trigramOverlap: 0,
                matchedCaseIds: [],
                matchedFragmentIds: [],
                reasons: []
              }
            },
        telemetry: telemetry()
      }))
    },
    writeDraft: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async () => ({
        output: args.writeDraftInvoke ? await args.writeDraftInvoke() : "Short grounded cover letter.",
        telemetry: telemetry()
      }))
    },
    reviseDraft: {
      invoke: vi.fn(),
      invokeWithTelemetry: vi.fn(async (prompt: string) => ({
        output: args.reviseDraftInvoke ? await args.reviseDraftInvoke(prompt) : "Short grounded cover letter.",
        telemetry: telemetry()
      }))
    }
  };
}

describe("runCreateProposal", () => {
  it("answers link questions directly from candidate external profiles", async () => {
    const answerQuestionsInvoke = vi.fn(async () => {
      throw new Error("Question answering model should not be called for direct link questions.");
    });

    const result = await runCreateProposal(
      {
        candidateId: 7,
        jobInput: {
          title: "Healthcare platform build",
          description: "Need a senior engineer to build a clinician-facing healthcare platform with HIPAA awareness.",
          proposalQuestions: [
            {
              position: 1,
              prompt: "Include a link to your GitHub profile and/or website"
            }
          ]
        }
      },
      {
        loadCandidateProfile: async () => ({
          ...baseCandidateProfile,
          externalProfiles: {
            githubUrl: "https://github.com/example",
            websiteUrl: "https://example.com"
          }
        }),
        retrieveContext: async () => ({
          retrievedContext: baseRetrievedContext,
          stepTelemetry: []
        }),
        graphDependencies: {
          runners: buildRunners({
            answerQuestionsInvoke
          })
        }
      }
    );

    expect(result.questionAnswers).toEqual([
      {
        position: 1,
        prompt: "Include a link to your GitHub profile and/or website",
        answer: "GitHub: https://github.com/example\nWebsite: https://example.com"
      }
    ]);
    expect(result.unresolvedQuestions).toEqual([]);
    expect(result.executionTrace).toContain("answer_questions");
    expect(answerQuestionsInvoke).not.toHaveBeenCalled();
  });

  it("passes retrieved evidence into question answering and keeps unresolved prompts blank", async () => {
    const result = await runCreateProposal(
      {
        candidateId: 7,
        jobInput: {
          title: "Healthcare platform build",
          description: "Need a senior engineer to build a clinician-facing healthcare platform with HIPAA awareness.",
          proposalQuestions: [
            {
              position: 1,
              prompt: "What healthcare projects have you shipped?"
            },
            {
              position: 2,
              prompt: "What is your expected hourly rate?"
            }
          ]
        }
      },
      {
        loadCandidateProfile: async () => baseCandidateProfile,
        retrieveContext: async () => ({
          retrievedContext: baseRetrievedContext,
          stepTelemetry: []
        }),
        graphDependencies: {
          runners: buildRunners({
            answerQuestionsInvoke: async (prompt) => {
              expect(prompt).toContain("Built HIPAA-compliant healthcare platforms used by clinicians.");
              expect(prompt).toContain("What healthcare projects have you shipped?");

              return {
                answers: [
                  {
                    position: 1,
                    prompt: "What healthcare projects have you shipped?",
                    answer: "Built HIPAA-compliant healthcare platforms used by clinicians."
                  }
                ],
                unresolved: [
                  {
                    position: 2,
                    prompt: "What is your expected hourly rate?",
                    reason: "No grounded rate data is available."
                  }
                ]
              };
            }
          })
        }
      }
    );

    expect(result.questionAnswers).toEqual([
      {
        position: 1,
        prompt: "What healthcare projects have you shipped?",
        answer: "Built HIPAA-compliant healthcare platforms used by clinicians."
      }
    ]);
    expect(result.unresolvedQuestions).toEqual([
      {
        position: 2,
        prompt: "What is your expected hourly rate?",
        reason: "No grounded rate data is available."
      }
    ]);
  });

  it("compresses an over-limit draft before critique and still answers proposal questions", async () => {
    const oversizedDraft = `${"Built clinician-facing AI workflows with Next.js and Node.js. ".repeat(90)}\n\nHappy to walk through the relevant delivery details.`;

    const result = await runCreateProposal(
      {
        candidateId: 7,
        jobInput: {
          title: "Healthcare platform build",
          description:
            "Need a senior engineer to build a clinician-facing healthcare platform with HIPAA awareness and strong delivery ownership.",
          proposalQuestions: [
            {
              position: 1,
              prompt: "Describe your recent experience with similar projects"
            }
          ]
        }
      },
      {
        loadCandidateProfile: async () => baseCandidateProfile,
        retrieveContext: async () => ({
          retrievedContext: baseRetrievedContext,
          stepTelemetry: []
        }),
        graphDependencies: {
          runners: buildRunners({
            writeDraftInvoke: async () => oversizedDraft,
            reviseDraftInvoke: async (prompt) => {
              expect(prompt).toContain("Hard maximum: 5000 characters");
              return "I’ve shipped clinician-facing healthcare platforms with strong backend ownership across Next.js and Node.js, including HIPAA-aware delivery work.\n\nHappy to walk through the closest examples and scope the fastest path forward.";
            },
            answerQuestionsInvoke: async () => ({
              answers: [
                {
                  position: 1,
                  prompt: "Describe your recent experience with similar projects",
                  answer: "Built HIPAA-compliant healthcare platforms used by clinicians."
                }
              ],
              unresolved: []
            })
          })
        }
      }
    );

    expect(result.finalProposal.length).toBeLessThanOrEqual(5000);
    expect(result.coverLetterCharCount).toBe(result.finalProposal.length);
    expect(result.executionTrace).toContain("enforce_length.compress");
    expect(result.executionTrace).toContain("answer_questions");
    expect(result.questionAnswers).toHaveLength(1);
    expect(result.approvalStatus).toBe("APPROVED");
  });

  it("falls back to deterministic reduction when compression still exceeds 5000 characters", async () => {
    const oversizedDraft = [
      `${"I’ve led complex full-stack AI delivery across CRMs and workflow automation. ".repeat(45)}`,
      `${"I’ve owned backend architecture, data modeling, integrations, and production support. ".repeat(45)}`,
      `${"I move quickly, communicate clearly, and keep scope grounded in business outcomes. ".repeat(45)}`,
      "Happy to walk through the closest examples and outline a pragmatic implementation plan."
    ].join("\n\n");

    const result = await runCreateProposal(
      {
        candidateId: 7,
        jobInput: {
          title: "AI CRM system build",
          description:
            "Need an experienced engineer to design and ship an AI-enhanced CRM with strong backend ownership, workflow automation, and production-ready delivery.",
          proposalQuestions: []
        }
      },
      {
        loadCandidateProfile: async () => baseCandidateProfile,
        retrieveContext: async () => ({
          retrievedContext: baseRetrievedContext,
          stepTelemetry: []
        }),
        graphDependencies: {
          runners: buildRunners({
            writeDraftInvoke: async () => oversizedDraft,
            reviseDraftInvoke: async () => oversizedDraft
          })
        }
      }
    );

    expect(result.finalProposal.length).toBeLessThanOrEqual(5000);
    expect(result.coverLetterCharCount).toBe(result.finalProposal.length);
    expect(result.executionTrace).toContain("enforce_length.reduce");
    expect(result.draftHistory.at(-1)).toBe(result.finalProposal);
  });

  it("reduces an over-limit final draft instead of throwing from the service fallback", async () => {
    const result = await runCreateProposal(
      {
        candidateId: 7,
        jobInput: {
          title: "Healthcare platform build",
          description:
            "Need a senior engineer to build a clinician-facing healthcare platform with HIPAA awareness and strong delivery ownership.",
          proposalQuestions: []
        }
      },
      {
        loadCandidateProfile: async () => baseCandidateProfile,
        retrieveContext: async () => ({
          retrievedContext: baseRetrievedContext,
          stepTelemetry: []
        }),
        runGraph: async (initialState) => ({
          ...createProposalEngineInitialState({
            candidateProfile: initialState.candidateProfile,
            jobInput: initialState.jobInput,
            maxRevisions: initialState.maxRevisions
          }),
          jobUnderstanding: baseJobUnderstanding,
          retrievedContext: baseRetrievedContext,
          proposalPlan: {
            openingAngle: "Lead with healthcare delivery experience.",
            mainPoints: ["Healthcare delivery"],
            selectedEvidenceIds: ["evidence_1"],
            selectedFragmentIds: ["fragment_1"],
            avoid: [],
            ctaStyle: "Short CTA"
          },
          latestCritique: {
            rubric: {
              relevance: 5,
              specificity: 5,
              credibility: 5,
              tone: 5,
              clarity: 5,
              ctaStrength: 5
            },
            issues: [],
            revisionInstructions: [],
            approvalStatus: "APPROVED",
            copyRisk: {
              triggered: false,
              maxParagraphCosine: 0,
              trigramOverlap: 0,
              matchedCaseIds: [],
              matchedFragmentIds: [],
              reasons: []
            }
          },
          currentDraft: "x".repeat(5001),
          finalProposal: "x".repeat(5001)
        }),
        graphDependencies: {
          runners: buildRunners({})
        }
      }
    );

    expect(result.finalProposal.length).toBeLessThanOrEqual(5000);
    expect(result.executionTrace).toContain("enforce_length.reduce");
    expect(result.coverLetterCharCount).toBe(result.finalProposal.length);
  });
});
