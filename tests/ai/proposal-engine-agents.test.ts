import { afterEach, describe, expect, it, vi } from "vitest";

import { createProposalEngineRunners } from "@/src/lib/proposal-engine/agents";

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
});
