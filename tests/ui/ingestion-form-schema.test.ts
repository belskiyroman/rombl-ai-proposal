import { describe, expect, it } from "vitest";

import {
  candidateEvidenceFormSchema,
  candidateProfileFormSchema,
  historicalCaseFormSchema
} from "@/lib/schemas/ingestion-form-schema";

describe("candidateProfileFormSchema", () => {
  it("accepts a valid candidate profile payload", () => {
    const result = candidateProfileFormSchema.safeParse({
      candidateId: 1,
      displayName: "Roman Belskiy",
      positioningSummary:
        "Senior full-stack engineer focused on MVP architecture, ownership, API integrations, and high-signal client communication.",
      toneProfile: "consultative",
      coreDomains: ["SaaS", "Media"],
      preferredCtaStyle: "Short confident CTA",
      seniority: "Senior",
      availability: "20h/week",
      location: "EU",
      githubUrl: "https://github.com/example",
      websiteUrl: "https://example.com"
    });

    expect(result.success).toBe(true);
  });

  it("rejects a profile without core domains", () => {
    const result = candidateProfileFormSchema.safeParse({
      candidateId: 1,
      displayName: "Roman",
      positioningSummary:
        "Senior full-stack engineer focused on MVP architecture, ownership, API integrations, and high-signal client communication.",
      toneProfile: "consultative",
      coreDomains: [],
      preferredCtaStyle: "CTA"
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid external profile URLs", () => {
    const result = candidateProfileFormSchema.safeParse({
      candidateId: 1,
      displayName: "Roman",
      positioningSummary:
        "Senior full-stack engineer focused on MVP architecture, ownership, API integrations, and high-signal client communication.",
      toneProfile: "consultative",
      coreDomains: ["SaaS"],
      preferredCtaStyle: "CTA",
      githubUrl: "not-a-url"
    });

    expect(result.success).toBe(false);
  });
});

describe("candidateEvidenceFormSchema", () => {
  it("accepts raw evidence notes", () => {
    const result = candidateEvidenceFormSchema.safeParse({
      candidateId: 1,
      rawEvidenceText:
        "Built multiple MVPs with Next.js and Node.js, owned architecture decisions, and led client communication through delivery."
    });

    expect(result.success).toBe(true);
  });
});

describe("historicalCaseFormSchema", () => {
  it("accepts a historical case with outcome labels", () => {
    const result = historicalCaseFormSchema.safeParse({
      candidateId: 1,
      jobTitle: "Build SaaS MVP",
      jobDescription:
        "Need a senior engineer to build a SaaS MVP with Next.js, API integrations, and architecture ownership.",
      proposalText:
        "I have built SaaS MVPs with Next.js and Node.js, owned architecture from day one, and can keep delivery crisp and transparent.",
      reply: true,
      interview: true,
      hired: false
    });

    expect(result.success).toBe(true);
  });

  it("rejects a case with too-short proposal text", () => {
    const result = historicalCaseFormSchema.safeParse({
      candidateId: 1,
      jobTitle: "Build SaaS MVP",
      jobDescription:
        "Need a senior engineer to build a SaaS MVP with Next.js, API integrations, and architecture ownership.",
      proposalText: "Too short",
      reply: false,
      interview: false,
      hired: false
    });

    expect(result.success).toBe(false);
  });
});
