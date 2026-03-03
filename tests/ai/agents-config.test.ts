import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveOpenAIModel } from "@/src/lib/ai/agents";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveOpenAIModel", () => {
  it("uses explicitly provided model when passed", () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");

    expect(resolveOpenAIModel("gpt-4.1-mini")).toBe("gpt-4.1-mini");
  });

  it("uses OPENAI_MODEL when explicit model is not provided", () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");

    expect(resolveOpenAIModel()).toBe("gpt-5-mini");
  });

  it("falls back to gpt-4o-mini when both explicit and env models are missing", () => {
    vi.stubEnv("OPENAI_MODEL", "");

    expect(resolveOpenAIModel()).toBe("gpt-4o-mini");
  });
});
