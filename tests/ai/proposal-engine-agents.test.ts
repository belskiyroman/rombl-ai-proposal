import { afterEach, describe, expect, it, vi } from "vitest";

import { createProposalEngineRunners } from "@/src/lib/proposal-engine/agents";
import { candidateEvidenceExtractionSchema } from "@/src/lib/proposal-engine/schemas";

const originalPerformance = globalThis.performance;

afterEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(globalThis, "performance", {
    value: originalPerformance,
    configurable: true,
    writable: true
  });
});

describe("createProposalEngineRunners", () => {
  it("polyfills performance before constructing LangChain models", () => {
    Object.defineProperty(globalThis, "performance", {
      value: undefined,
      configurable: true,
      writable: true
    });
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    createProposalEngineRunners();

    expect(globalThis.performance).toBeDefined();
    expect(typeof globalThis.performance.now).toBe("function");
  });

  it("uses nullable fields for candidate evidence structured extraction", () => {
    const result = candidateEvidenceExtractionSchema.parse({
      blocks: [
        {
          type: "project",
          text: "Built and shipped multiple SaaS MVPs with Next.js and Node.js.",
          tags: ["MVP", "Next.js"],
          title: null,
          techStack: ["Next.js", "Node.js"],
          domains: ["SaaS"],
          impactSummary: null
        }
      ]
    });

    expect(result.blocks[0]?.title).toBeNull();
    expect(result.blocks[0]?.impactSummary).toBeNull();
  });
});
