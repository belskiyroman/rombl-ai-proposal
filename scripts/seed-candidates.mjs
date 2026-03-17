import path from "node:path";
import { fileURLToPath } from "node:url";

import { ConvexHttpClient } from "convex/browser";

import { loadCandidateSeedFiles, normalizeCandidateSeed } from "./seed-candidate-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const seedsDirectory = path.join(workspaceRoot, "seeds", "candidates");

function resolveConvexUrl() {
  const candidateUrl = process.env.CONVEX_SELF_HOSTED_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (typeof candidateUrl !== "string" || candidateUrl.trim().length === 0) {
    throw new Error("Set CONVEX_SELF_HOSTED_URL or NEXT_PUBLIC_CONVEX_URL before running the seed script.");
  }

  return candidateUrl.trim();
}

async function main() {
  const convexUrl = resolveConvexUrl();
  const client = new ConvexHttpClient(convexUrl);
  const seedEntries = await loadCandidateSeedFiles(seedsDirectory);

  if (seedEntries.length === 0) {
    console.log(`No candidate seed files found in ${seedsDirectory}.`);
    return;
  }

  for (const entry of seedEntries) {
    const normalizedSeed = normalizeCandidateSeed(entry.rawCandidate);
    const result = await client.action("profiles:seedCandidateProfile", normalizedSeed);
    console.log(
      `Seeded candidate ${result.candidateId} (${normalizedSeed.displayName}) from ${path.basename(entry.filePath)} with ${result.evidenceCount} evidence blocks.`
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
