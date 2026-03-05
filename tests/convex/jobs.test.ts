import { describe, expect, it, vi } from "vitest";

import { internal } from "@/convex/_generated/api";
import { buildPairsList, createIngestionMutationAdapters, runIngestJobProposalPair } from "@/convex/jobs";

describe("runIngestJobProposalPair", () => {
  it("runs analyzer-only graph + embedding and stores phase-1 ingestion records", async () => {
    const sampleJob = {
      jobLink: "https://www.upwork.com/freelance-jobs/apply/Full-Stack-Dev_~01/",
      clientLocation: "CAN",
      clientReview: 4.6,
      clientReviewAmount: 2,
      clientTotalSpent: 750,
      type: "hourly/fixedPrice" as const,
      skills: ["Python", "PostgreSQL", "React", "Node.js", "JavaScript"],
      title: "Full-Stack Developer Needed",
      text: "Need React, Next.js, Node.js and REST API integrations for existing SaaS."
    };

    const sampleProposal = {
      id: 1,
      viewed: true,
      interview: true,
      offer: true,
      price: "1000",
      agency: true,
      memberId: 20,
      text: "Hello, I am Roman. We can recommend a UI/UX designer. Our seniors have 10+ years."
    };

    const sampleMember = {
      id: 20,
      name: "Roman Belskiy",
      agency: true,
      agencyName: "DataGarden",
      talentBadge: "topPluse",
      jss: 100,
      location: "UA"
    };

    const embed = vi.fn().mockResolvedValue([0.11, 0.22, 0.33]);
    const runAnalyzerGraph = vi.fn().mockResolvedValue({
      tech_stack: ["React", "Next.js", "Node.js", "REST API integrations"],
      writing_style_analysis: {
        formality: 6,
        enthusiasm: 7,
        key_vocabulary: [
          "uses active verbs",
          "offers UI/UX designer",
          "mentions team seniority"
        ],
        sentence_structure: "short, direct, action-first"
      },
      project_constraints: ["extend existing SaaS product", "ui/ux redesign in separate budget"],
      executionTrace: ["analyzer"]
    });
    const insertRawJob = vi.fn().mockResolvedValue("raw_job_1");
    const insertStyleProfile = vi.fn().mockResolvedValue("style_profile_1");
    const insertProcessedProposal = vi.fn().mockResolvedValue("processed_proposal_1");
    const now = vi.fn().mockReturnValue(1_710_000_000_000);

    const result = await runIngestJobProposalPair(
      {
        source: "manual",
        job: sampleJob,
        proposal: sampleProposal,
        member: sampleMember
      },
      {
        embed,
        runAnalyzerGraph,
        insertRawJob,
        insertStyleProfile,
        insertProcessedProposal,
        now
      }
    );

    expect(embed).toHaveBeenCalledWith(sampleJob.text);
    expect(runAnalyzerGraph).toHaveBeenCalledWith({
      newJobDescription: sampleJob.text,
      ragContext: [
        {
          jobText: sampleJob.text,
          proposalText: sampleProposal.text,
          similarity: 1
        }
      ]
    });

    expect(insertRawJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobLink: sampleJob.jobLink,
        clientLocation: sampleJob.clientLocation,
        clientTotalSpent: sampleJob.clientTotalSpent,
        embedding: [0.11, 0.22, 0.33],
        techStack: ["React", "Next.js", "Node.js", "REST API integrations"],
        projectConstraints: ["extend existing SaaS product", "ui/ux redesign in separate budget"],
        memberId: sampleMember.id
      })
    );

    expect(insertStyleProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: sampleMember.id,
        memberName: sampleMember.name,
        writingStyleAnalysis: {
          formality: 6,
          enthusiasm: 7,
          keyVocabulary: [
            "uses active verbs",
            "offers UI/UX designer",
            "mentions team seniority"
          ],
          sentenceStructure: "short, direct, action-first"
        }
      })
    );

    expect(insertProcessedProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        externalProposalId: sampleProposal.id,
        memberId: sampleMember.id,
        price: "1000",
        priceAmount: 1000,
        rawJobId: "raw_job_1",
        styleProfileId: "style_profile_1"
      })
    );

    expect(result).toEqual({
      rawJobId: "raw_job_1",
      styleProfileId: "style_profile_1",
      processedProposalId: "processed_proposal_1",
      executionTrace: ["analyzer"]
    });
  });
});

describe("createIngestionMutationAdapters", () => {
  it("invokes ctx.runMutation with Convex function references, not direct function objects", async () => {
    const runMutation = vi.fn().mockResolvedValue("stored_id");
    const adapters = createIngestionMutationAdapters(runMutation);

    const rawJobDoc = {
      source: "manual",
      jobLink: "https://www.upwork.com/freelance-jobs/apply/Full-Stack-Dev_~01/",
      clientLocation: "CAN",
      clientReview: 4.6,
      clientReviewAmount: 2,
      clientTotalSpent: 750,
      projectType: "hourly/fixedPrice",
      skills: ["React"],
      title: "Full-Stack Developer Needed",
      text: "Need React and Node.js",
      embedding: [0.1, 0.2],
      techStack: ["React", "Node.js"],
      projectConstraints: ["extend existing SaaS product"],
      memberId: 20,
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_000_000
    } as const;

    const styleProfileDoc = {
      source: "manual",
      memberId: 20,
      memberName: "Roman Belskiy",
      memberLocation: "UA",
      agency: true,
      agencyName: "DataGarden",
      talentBadge: "topPluse",
      jss: 100,
      writingStyleAnalysis: {
        formality: 6,
        enthusiasm: 7,
        keyVocabulary: ["uses active verbs"],
        sentenceStructure: "short, direct"
      },
      keyVocabulary: ["uses active verbs"],
      sentenceStructure: "short, direct",
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_000_000
    } as const;

    const proposalDoc = {
      source: "manual",
      externalProposalId: 1,
      memberId: 20,
      viewed: true,
      interview: true,
      offer: true,
      price: "1000",
      priceAmount: 1000,
      agency: true,
      text: "Hello from Roman",
      rawJobId: "raw_job_1",
      styleProfileId: "style_profile_1",
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_000_000
    } as const;

    await adapters.insertRawJob(rawJobDoc as never);
    await adapters.insertStyleProfile(styleProfileDoc as never);
    await adapters.insertProcessedProposal(proposalDoc as never);

    expect(runMutation).toHaveBeenNthCalledWith(1, internal.jobs.insertRawJobRecord, {
      document: rawJobDoc
    });
    expect(runMutation).toHaveBeenNthCalledWith(2, internal.jobs.insertStyleProfileRecord, {
      document: styleProfileDoc
    });
    expect(runMutation).toHaveBeenNthCalledWith(3, internal.jobs.insertProcessedProposalRecord, {
      document: proposalDoc
    });
  });
});

describe("buildPairsList", () => {
  it("joins jobs, proposals, and style profiles sorted by createdAt desc", () => {
    const result = buildPairsList({
      processedProposals: [
        {
          _id: "proposal_older",
          externalProposalId: 11,
          rawJobId: "raw_1",
          styleProfileId: "style_1",
          externalJobId: 101,
          memberId: 20,
          viewed: true,
          interview: false,
          offer: false,
          price: "900",
          priceAmount: 900,
          agency: true,
          text: "Older proposal",
          createdAt: 1_710_000_000_000
        },
        {
          _id: "proposal_newer",
          externalProposalId: 22,
          rawJobId: "raw_2",
          styleProfileId: "style_2",
          externalJobId: 202,
          memberId: 30,
          viewed: true,
          interview: true,
          offer: true,
          price: "1200",
          priceAmount: 1200,
          agency: false,
          text: "Newer proposal",
          createdAt: 1_720_000_000_000
        }
      ],
      rawJobs: [
        {
          _id: "raw_1",
          externalJobId: 101,
          title: "Legacy dashboard updates",
          clientLocation: "US",
          clientReview: 4.2,
          clientTotalSpent: 15000,
          techStack: ["React", "Node.js"]
        },
        {
          _id: "raw_2",
          externalJobId: 202,
          title: "AI workflow tooling",
          clientLocation: "CAN",
          clientReview: 4.9,
          clientTotalSpent: 85000,
          techStack: ["TypeScript", "Convex", "OpenAI"]
        }
      ],
      styleProfiles: [
        {
          _id: "style_1",
          memberId: 20,
          memberName: "Roman Belskiy",
          memberLocation: "UA",
          jss: 100
        },
        {
          _id: "style_2",
          memberId: 30,
          memberName: "Iryna K",
          memberLocation: "PL",
          jss: 98
        }
      ]
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      processedProposalId: "proposal_newer",
      createdAt: 1_720_000_000_000,
      job: {
        title: "AI workflow tooling",
        clientTotalSpent: 85000,
        clientReview: 4.9,
        techStack: ["TypeScript", "Convex", "OpenAI"]
      },
      proposal: {
        externalProposalId: 22,
        price: "1200",
        priceAmount: 1200
      },
      styleProfile: {
        memberName: "Iryna K",
        memberLocation: "PL",
        jss: 98
      }
    });
    expect(result[1].processedProposalId).toBe("proposal_older");
  });

  it("skips proposals with missing joined records", () => {
    const result = buildPairsList({
      processedProposals: [
        {
          _id: "proposal_missing_links",
          externalProposalId: 1,
          rawJobId: "raw_missing",
          styleProfileId: "style_missing",
          externalJobId: 101,
          memberId: 20,
          viewed: true,
          interview: false,
          offer: false,
          price: "500",
          priceAmount: 500,
          agency: false,
          text: "Test",
          createdAt: 1_710_000_000_000
        }
      ],
      rawJobs: [],
      styleProfiles: []
    });

    expect(result).toEqual([]);
  });
});
