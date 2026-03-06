import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatOpenAI } from "@langchain/openai";

import {
  DEFAULT_FAST_MODEL,
  DEFAULT_REASONING_MODEL,
  getLLM
} from "@/src/lib/ai/models";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getLLM", () => {
  it("returns fast and reasoning models with expected defaults", () => {
    const fast = getLLM("fast", { apiKey: "sk-test" });
    const reasoning = getLLM("reasoning", { apiKey: "sk-test" });

    expect(fast).toBeInstanceOf(ChatOpenAI);
    expect(reasoning).toBeInstanceOf(ChatOpenAI);
    expect(fast.model).toBe(DEFAULT_FAST_MODEL);
    expect(reasoning.model).toBe(DEFAULT_REASONING_MODEL);
    expect(fast.invocationParams().temperature).toBeUndefined();
    expect(reasoning.invocationParams().temperature).toBeUndefined();
  });

  it("uses OPENAI_FAST_MODEL and OPENAI_REASONING_MODEL when set", () => {
    vi.stubEnv("OPENAI_FAST_MODEL", "gpt-5-mini-custom");
    vi.stubEnv("OPENAI_REASONING_MODEL", "gpt-5.4-custom");

    const fast = getLLM("fast", { apiKey: "sk-test" });
    const reasoning = getLLM("reasoning", { apiKey: "sk-test" });

    expect(fast.model).toBe("gpt-5-mini-custom");
    expect(reasoning.model).toBe("gpt-5.4-custom");
  });

  it("allows explicit per-tier model overrides", () => {
    vi.stubEnv("OPENAI_FAST_MODEL", "gpt-5-mini-env");
    vi.stubEnv("OPENAI_REASONING_MODEL", "gpt-5.4-env");

    const fast = getLLM("fast", {
      apiKey: "sk-test",
      fastModel: "gpt-5-mini-explicit"
    });
    const reasoning = getLLM("reasoning", {
      apiKey: "sk-test",
      reasoningModel: "gpt-5.4-explicit"
    });

    expect(fast.model).toBe("gpt-5-mini-explicit");
    expect(reasoning.model).toBe("gpt-5.4-explicit");
  });

  it("falls back to OPENAI_MODEL when tier-specific env vars are absent", () => {
    vi.stubEnv("OPENAI_FAST_MODEL", "");
    vi.stubEnv("OPENAI_REASONING_MODEL", "");
    vi.stubEnv("OPENAI_MODEL", "gpt-5-fallback");

    const fast = getLLM("fast", { apiKey: "sk-test" });
    const reasoning = getLLM("reasoning", { apiKey: "sk-test" });

    expect(fast.model).toBe("gpt-5-fallback");
    expect(reasoning.model).toBe("gpt-5-fallback");
  });

  it("omits temperature for GPT-5-family fast models", () => {
    const fast = getLLM("fast", {
      apiKey: "sk-test",
      fastModel: "gpt-5-mini-custom",
      fastTemperature: 0.4
    });

    expect(fast.model).toBe("gpt-5-mini-custom");
    expect(fast.invocationParams().temperature).toBeUndefined();
  });

  it("keeps explicit temperature for non GPT-5 fast models", () => {
    const fast = getLLM("fast", {
      apiKey: "sk-test",
      fastModel: "gpt-4.1-mini",
      fastTemperature: 0.4
    });

    expect(fast.model).toBe("gpt-4.1-mini");
    expect(fast.invocationParams().temperature).toBe(0.4);
  });
});
