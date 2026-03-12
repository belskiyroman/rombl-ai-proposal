import { describe, expect, it } from "vitest";

import { buildGenerationRunDocument } from "@/convex/generate";

describe("buildGenerationRunDocument", () => {
  it("persists execution trace, candidate snapshot, retrieved context, and telemetry", () => {
    const document = buildGenerationRunDocument({
      candidateId: 7,
      jobInput: {
        title: "Senior Next.js Engineer",
        description: "Need someone to own the architecture and ship the MVP."
      },
      createdAt: 123456789,
      result: {
        finalProposal: "Final grounded proposal",
        approvalStatus: "APPROVED",
        critiqueHistory: [
          {
            rubric: {
              relevance: 0.9,
              specificity: 0.8,
              credibility: 0.9,
              tone: 0.8,
              clarity: 0.9,
              ctaStrength: 0.8
            },
            issues: [],
            revisionInstructions: [],
            approvalStatus: "APPROVED",
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
        executionTrace: ["job_understanding", "retrieve_context", "write_draft", "critique"],
        selectedEvidence: [
          {
            id: "ev_1",
            reason: "Direct MVP ownership evidence",
            text: "Built and launched multiple MVPs with Next.js and Node.js.",
            type: "project"
          }
        ],
        retrievedContext: {
          similarCases: [
            {
              _id: "case_1",
              clusterId: "cluster_1",
              candidateId: 7,
              canonical: true,
              jobTitle: "MVP Platform Build",
              jobExtract: {
                projectType: "MVP",
                domain: "SaaS",
                requiredSkills: ["Next.js"],
                optionalSkills: ["AWS"],
                senioritySignals: ["senior"],
                deliverables: ["ship MVP"],
                constraints: ["tight timeline"],
                stack: ["Next.js", "Node.js"],
                softSignals: ["ownership"],
                jobLengthBucket: "medium",
                clientNeeds: ["ownership"],
                summary: "Build an MVP with strong ownership."
              } as any,
              proposalExtract: {
                hook: "I can own this MVP end-to-end.",
                valueProposition: "Strong ownership and shipping speed.",
                experienceClaims: ["Built SaaS MVPs"],
                techMapping: ["Next.js -> MVP frontend"],
                proofPoints: ["Built SaaS MVPs"],
                cta: "Happy to discuss next steps.",
                tone: "consultative",
                lengthBucket: "medium",
                specificityScore: 0.81,
                genericnessScore: 0.19
              } as any,
              quality: {
                rubric: {
                  relevance: 0.9,
                  specificity: 0.8,
                  credibility: 0.9,
                  tone: 0.8,
                  clarity: 0.9,
                  ctaStrength: 0.8
                },
                overall: 0.86,
                humanScore: 0.8,
                specificityScore: 0.82,
                genericnessScore: 0.18
              },
              outcome: {
                reply: true,
                interview: true,
                hired: false
              }
            }
          ],
          fragments: {
            openings: [
              {
                _id: "fragment_1",
                clusterId: "cluster_1",
                candidateId: 7,
                fragmentType: "opening",
                text: "I can own this MVP end-to-end.",
                tags: ["ownership"],
                specificityScore: 0.8,
                genericnessScore: 0.2,
                qualityScore: 0.85,
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
              type: "project",
              text: "Built SaaS MVPs in production.",
              tags: ["MVP"],
              techStack: ["Next.js"],
              domains: ["SaaS"],
              confidence: 0.95,
              active: true,
              source: "candidate_profile"
            }
          ]
        },
        jobUnderstanding: {
          jobSummary: "Need an engineer to own MVP architecture and delivery.",
          clientNeeds: ["ownership", "MVP"],
          mustHaveSkills: ["Next.js"],
          niceToHaveSkills: ["AWS"],
          projectRiskFlags: ["scope risk"],
          proposalStrategy: {
            tone: "consultative",
            length: "medium",
            focus: ["ownership", "execution clarity"]
          }
        },
        proposalPlan: {
          openingAngle: "Mirror the ownership need and lead with MVP fit.",
          mainPoints: ["MVP experience", "Architecture ownership"],
          selectedEvidenceIds: ["ev_1"],
          selectedFragmentIds: ["fragment_1"],
          avoid: ["generic phrasing"],
          ctaStyle: "Short CTA"
        },
        draftHistory: ["Draft 1"],
        copyRisk: {
          triggered: false,
          maxParagraphCosine: 0.1,
          trigramOverlap: 0.05,
          matchedCaseIds: [],
          matchedFragmentIds: [],
          reasons: []
        },
        stepTelemetry: [
          {
            step: "job_understanding",
            stage: "job_understanding",
            kind: "llm",
            startedAt: 100,
            finishedAt: 200,
            durationMs: 100,
            model: "gpt-5-mini",
            tokenUsage: {
              inputTokens: 120,
              outputTokens: 40,
              totalTokens: 160,
              reasoningTokens: 0
            }
          }
        ],
        telemetrySummary: {
          totalSteps: 1,
          totalDurationMs: 100,
          totalInputTokens: 120,
          totalOutputTokens: 40,
          totalTokens: 160,
          totalReasoningTokens: 0
        },
        state: {
          candidateProfile: {
            candidateId: 7,
            displayName: "Roman",
            positioningSummary: "Senior full-stack engineer focused on MVP delivery.",
            toneProfile: "consultative",
            coreDomains: ["SaaS"],
            preferredCtaStyle: "Short CTA"
          },
          jobInput: {
            title: "Senior Next.js Engineer",
            description: "Need someone to own the architecture and ship the MVP."
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
          revisionCount: 0,
          maxRevisions: 2,
          executionTrace: [],
          stepTelemetry: []
        }
      }
    });

    expect(document.candidateSnapshot.displayName).toBe("Roman");
    expect(document.executionTrace).toEqual(["job_understanding", "retrieve_context", "write_draft", "critique"]);
    expect(document.retrievedContextSnapshot.similarCases).toHaveLength(1);
    expect(document.retrievedContextSnapshot.similarCases[0]?.jobExtract).not.toHaveProperty("constraints");
    expect(document.retrievedContextSnapshot.similarCases[0]?.jobExtract.summary).toBe(
      "Build an MVP with strong ownership."
    );
    expect(document.stepTelemetry[0]?.tokenUsage?.totalTokens).toBe(160);
    expect(document.retrievedCaseIds).toHaveLength(1);
    expect(document.retrievedFragmentIds).toEqual(["fragment_1"]);
    expect(document.retrievedEvidenceIds).toEqual(["evidence_1"]);
  });
});
