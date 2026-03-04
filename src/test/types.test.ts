import { describe, expect, it } from "vitest";

import schema from "@/convex/schema";
import {
  jobSchema,
  memberSchema,
  parseProposalPrice,
  processedProposalDocumentSchema,
  proposalSchema,
  rawJobDocumentSchema,
  styleProfileDocumentSchema
} from "@/src/lib/ai/types";

const sampleJob = {
  id: 1,
  clientLocation: "CAN",
  clientReview: 4.6,
  clientReviewAmount: 2,
  clientTotalSpent: 750,
  type: "hourly/fixedPrice",
  skills: ["Python", "PostgreSQL", "React", "Node.js", "JavaScript"],
  title: "Full-Stack Developer (or Small Team) Needed to Extend Existing SaaS Platform (React / Next.js)",
  text: "I’m looking for an experienced full-stack developer or a small backend/frontend team to extend and enhance an existing SaaS product..."
};

const sampleProposal = {
  id: 1,
  jobId: 1,
  viewed: true,
  interview: true,
  offer: true,
  price: "1000",
  agency: true,
  memberId: 20,
  text: "Hello, I am Roman..."
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

function getTableFieldValidator(tableName: string, field: string): { kind: string } {
  type ConvexTable = { validator: { fields: Record<string, { kind: string }> } };
  const table = (schema as unknown as { tables: Record<string, ConvexTable> }).tables[tableName];
  if (!table) {
    throw new Error(`Table ${tableName} was not found in Convex schema`);
  }

  const fieldValidator = table.validator.fields[field];
  if (!fieldValidator) {
    throw new Error(`Field ${field} was not found in Convex table ${tableName}`);
  }

  return fieldValidator;
}

function mockConvexTypeValidation(fieldName: string, validatorKind: string, value: unknown): void {
  const isValidFloat = typeof value === "number" && Number.isFinite(value);
  const isValidString = typeof value === "string";

  if (validatorKind === "float64" && !isValidFloat) {
    throw new TypeError(`Invalid value for ${fieldName}. Expected float64.`);
  }

  if (validatorKind === "string" && !isValidString) {
    throw new TypeError(`Invalid value for ${fieldName}. Expected string.`);
  }
}

describe("job/proposal/member schemas", () => {
  it("accepts the real client samples and parses proposal price", () => {
    const parsedJob = jobSchema.parse(sampleJob);
    const parsedProposal = proposalSchema.parse(sampleProposal);
    const parsedMember = memberSchema.parse(sampleMember);

    expect(parsedJob.clientTotalSpent).toBe(750);
    expect(parsedJob.clientReview).toBe(4.6);
    expect(parsedJob.clientLocation).toBe("CAN");
    expect(parsedProposal.price).toBe("1000");
    expect(parseProposalPrice(parsedProposal.price)).toBe(1000);
    expect(parsedMember.location).toBe("UA");
  });
});

describe("convex schema alignment", () => {
  it("contains phase-1 ingestion tables and field types aligned with zod docs", () => {
    const rawJobsEmbedding = getTableFieldValidator("raw_jobs", "embedding");
    const rawJobsClientSpent = getTableFieldValidator("raw_jobs", "clientTotalSpent");
    const processedProposalPrice = getTableFieldValidator("processed_proposals", "price");
    const styleProfileMemberId = getTableFieldValidator("style_profiles", "memberId");

    expect(rawJobsEmbedding.kind).toBe("array");
    expect(rawJobsClientSpent.kind).toBe("float64");
    expect(processedProposalPrice.kind).toBe("string");
    expect(styleProfileMemberId.kind).toBe("float64");
  });

  it("rejects invalid document shapes using zod and mocked convex validator errors", () => {
    const invalidRawJob = {
      source: "manual",
      externalJobId: 1,
      clientLocation: "CAN",
      clientReview: 4.6,
      clientReviewAmount: 2,
      clientTotalSpent: "750",
      projectType: "hourly/fixedPrice",
      skills: ["React"],
      title: "Role",
      text: "Job text",
      embedding: [0.1, 0.2],
      techStack: ["React"],
      projectConstraints: [],
      memberId: 20,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const invalidProcessedProposal = {
      source: "manual",
      externalProposalId: 1,
      externalJobId: 1,
      memberId: 20,
      viewed: true,
      interview: true,
      offer: true,
      price: 1000,
      agency: true,
      text: "Proposal text",
      rawJobId: "k123",
      styleProfileId: "k234",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const invalidStyleProfile = {
      source: "manual",
      memberId: 20,
      memberName: "Roman",
      memberLocation: "UA",
      agency: true,
      agencyName: "DataGarden",
      talentBadge: "topPluse",
      jss: 100,
      writingStyleAnalysis: {
        formality: 6,
        enthusiasm: "7",
        keyVocabulary: ["team lead"],
        sentenceStructure: "short"
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(rawJobDocumentSchema.safeParse(invalidRawJob).success).toBe(false);
    expect(processedProposalDocumentSchema.safeParse(invalidProcessedProposal).success).toBe(false);
    expect(styleProfileDocumentSchema.safeParse(invalidStyleProfile).success).toBe(false);

    const clientTotalSpentValidator = getTableFieldValidator("raw_jobs", "clientTotalSpent");
    const proposalPriceValidator = getTableFieldValidator("processed_proposals", "price");

    expect(() =>
      mockConvexTypeValidation("clientTotalSpent", clientTotalSpentValidator.kind, invalidRawJob.clientTotalSpent)
    ).toThrow("Expected float64");
    expect(() => mockConvexTypeValidation("price", proposalPriceValidator.kind, invalidProcessedProposal.price)).toThrow(
      "Expected string"
    );
  });
});
