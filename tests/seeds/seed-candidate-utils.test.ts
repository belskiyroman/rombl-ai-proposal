import { describe, expect, it } from "vitest";

import { normalizeCandidateSeed, PRIMARY_TONE } from "@/scripts/seed-candidate-utils.mjs";

describe("normalizeCandidateSeed", () => {
  it("maps toneProfile[] to consultative and appends the other tones to notes", () => {
    const result = normalizeCandidateSeed({
      candidateId: 1,
      displayName: "Yurii Shepitko",
      positioningSummary: "Senior full-stack engineer focused on architecture, delivery, and stakeholder communication.",
      toneProfile: ["consultative", "confident", "technical", "founder-like"],
      preferredCtaStyle: "Clear CTA",
      coreDomains: ["SaaS", "AI Integrations"],
      notes: "Founder-friendly engineer.",
      githubUrl: "",
      websiteUrl: "",
      portfolioUrl: "",
      evidence: "Built production systems with Next.js and Node.js."
    });

    expect(result.toneProfile).toBe(PRIMARY_TONE);
    expect(result.metadata.notes).toBe(
      "Founder-friendly engineer.\n\nAdditional tone signals: confident, technical, founder-like."
    );
  });

  it("omits empty external profile URLs and keeps evidence outside the profile document", () => {
    const result = normalizeCandidateSeed({
      candidateId: 1,
      displayName: "Yurii Shepitko",
      positioningSummary: "Senior full-stack engineer focused on architecture, delivery, and stakeholder communication.",
      toneProfile: ["consultative"],
      preferredCtaStyle: "Clear CTA",
      coreDomains: ["SaaS"],
      notes: "Some notes",
      githubUrl: "",
      websiteUrl: "   ",
      portfolioUrl: "",
      evidence: "Built production systems with Next.js and Node.js."
    });

    expect(result.metadata.externalProfiles).toEqual({
      githubUrl: undefined,
      websiteUrl: undefined,
      portfolioUrl: undefined
    });
    expect(result.rawEvidenceText).toBe("Built production systems with Next.js and Node.js.");
    expect(result.metadata).not.toHaveProperty("evidence");
  });
});
