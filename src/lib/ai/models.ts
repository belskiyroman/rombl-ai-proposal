import { ChatOpenAI } from "@langchain/openai";

import { getRequiredOpenAIApiKey } from "./openai-config";

export type LlmTier = "fast" | "reasoning";

export const DEFAULT_FAST_MODEL = "gpt-5-mini";
export const DEFAULT_REASONING_MODEL = "gpt-5.4";
const DEFAULT_FAST_TEMPERATURE = 0.2;

export interface LLMFactoryOptions {
  apiKey?: string;
  fastModel?: string;
  reasoningModel?: string;
  fastTemperature?: number;
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveModelForTier(tier: LlmTier, options: LLMFactoryOptions): string {
  if (tier === "fast") {
    return (
      options.fastModel?.trim() ||
      getOptionalEnv("OPENAI_FAST_MODEL") ||
      getOptionalEnv("OPENAI_MODEL") ||
      DEFAULT_FAST_MODEL
    );
  }

  return (
    options.reasoningModel?.trim() ||
    getOptionalEnv("OPENAI_REASONING_MODEL") ||
    getOptionalEnv("OPENAI_MODEL") ||
    DEFAULT_REASONING_MODEL
  );
}

function resolveApiKey(options: LLMFactoryOptions): string {
  const explicitKey = options.apiKey?.trim();
  if (explicitKey) {
    return explicitKey;
  }

  return getRequiredOpenAIApiKey();
}

function supportsCustomTemperature(model: string): boolean {
  // GPT-5-family models currently reject explicit temperature values in this setup.
  return !model.trim().toLowerCase().startsWith("gpt-5");
}

export function getLLM(tier: LlmTier, options: LLMFactoryOptions = {}): ChatOpenAI {
  const model = resolveModelForTier(tier, options);
  const apiKey = resolveApiKey(options);

  if (tier === "reasoning") {
    // Reasoning models perform best with provider-managed defaults.
    return new ChatOpenAI({
      model,
      apiKey
    });
  }

  if (supportsCustomTemperature(model)) {
    return new ChatOpenAI({
      model,
      temperature: options.fastTemperature ?? DEFAULT_FAST_TEMPERATURE,
      apiKey
    });
  }

  return new ChatOpenAI({
    model,
    apiKey
  });
}
