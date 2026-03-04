const missingOpenAiKeyMessage =
  "OPENAI_API_KEY is not configured for Convex actions. Set it with: npx convex env set OPENAI_API_KEY <your_key>";

export function getRequiredOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(missingOpenAiKeyMessage);
  }

  return key;
}

export function isMissingOpenAiKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("OPENAI_API_KEY");
}

export { missingOpenAiKeyMessage };
