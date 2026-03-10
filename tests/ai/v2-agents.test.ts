import { afterEach, describe, expect, it, vi } from "vitest";

import { createProposalEngineV2Runners } from "@/src/lib/ai/v2/agents";

const originalPerformance = globalThis.performance;

afterEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(globalThis, "performance", {
    value: originalPerformance,
    configurable: true,
    writable: true
  });
});

describe("createProposalEngineV2Runners", () => {
  it("polyfills performance before constructing LangChain models", () => {
    Object.defineProperty(globalThis, "performance", {
      value: undefined,
      configurable: true,
      writable: true
    });
    vi.stubEnv("OPENAI_API_KEY", "sk-test");

    createProposalEngineV2Runners();

    expect(globalThis.performance).toBeDefined();
    expect(typeof globalThis.performance.now).toBe("function");
  });
});
