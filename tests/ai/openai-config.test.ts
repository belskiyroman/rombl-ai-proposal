import { afterEach, describe, expect, it, vi } from "vitest";

import { getRequiredOpenAIApiKey } from "@/src/lib/ai/openai-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRequiredOpenAIApiKey", () => {
  it("throws an actionable error when OPENAI_API_KEY is missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(() => getRequiredOpenAIApiKey()).toThrow(
      "OPENAI_API_KEY is not configured for Convex actions. Set it with: npx convex env set OPENAI_API_KEY <your_key>"
    );
  });

  it("returns a trimmed key when OPENAI_API_KEY is provided", () => {
    vi.stubEnv("OPENAI_API_KEY", "  sk-test-key  ");

    expect(getRequiredOpenAIApiKey()).toBe("sk-test-key");
  });
});
